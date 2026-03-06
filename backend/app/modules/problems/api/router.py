from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.modules.auth.deps import get_current_user, require_roles
from app.modules.problems.api.schemas import (
    ProblemAdminListOut,
    ProblemAdminOut,
    ProblemCreate,
    ProblemOut,
    ProblemUpdate,
)
from app.modules.problems.data.models import ProblemDifficulty, ProblemStatus
from app.modules.problems.application.service import ProblemService
from app.modules.activity.application.service import ActivityService
from app.modules.users.data.models import UserRole
from app.settings import settings
from app.core.errors import BadRequest


router = APIRouter(tags=["problems"])


class PresignRequest(BaseModel):
    content_type: str = Field(min_length=1)
    file_name: str | None = None
    problem_id: uuid.UUID | None = None


class PresignResponse(BaseModel):
    upload_url: str
    final_url: str
    key: str
    content_type: str


class CanonicalizeRequest(BaseModel):
    text: str = Field(min_length=1)


class CanonicalizeResponse(BaseModel):
    canonical: str | None


class DistractorsRequest(BaseModel):
    question: str = Field(min_length=1)
    correct_answer: str = Field(min_length=1)
    count: int = Field(default=3, ge=1, le=6)


class DistractorsResponse(BaseModel):
    options: list[str]


class ExplanationRequest(BaseModel):
    question: str = Field(min_length=1)
    correct_answer: str = Field(min_length=1)
    choices: list[str] | None = None


class ExplanationResponse(BaseModel):
    explanation: str | None


class GenerateFromRagRequest(BaseModel):
    subject_id: uuid.UUID
    topic_id: uuid.UUID
    # Общее количество задач (fallback, если не заданы количества по уровням сложности)
    count: int = Field(default=10, ge=1, le=30)
    # Необязательные квоты по уровням сложности.
    # Если хотя бы одно из полей > 0, то суммарное количество задач
    # берётся как сумма easy+medium+hard (и дополнительно ограничивается 30).
    easy_count: int | None = Field(default=None, ge=0, le=30)
    medium_count: int | None = Field(default=None, ge=0, le=30)
    hard_count: int | None = Field(default=None, ge=0, le=30)


class GenerateFromRagResponse(BaseModel):
    items: list[ProblemAdminOut]
    created_count: int
    skipped_duplicates: int


class VideoJobResponse(BaseModel):
    job_id: uuid.UUID
    status: str


@router.post(
    "/problems/answers/canonicalize",
    response_model=CanonicalizeResponse,
)
async def preview_canonical(
    body: CanonicalizeRequest,
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    from app.modules.problems.application.canonicalize import normalize_for_storage
    return CanonicalizeResponse(canonical=normalize_for_storage(body.text))


@router.post(
    "/problems/answers/distractors",
    response_model=DistractorsResponse,
)
async def generate_distractors_api(
    body: DistractorsRequest,
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    from app.modules.problems.application.llm_distractors import generate_distractors

    options = await generate_distractors(
        question=body.question,
        correct_answer=body.correct_answer,
        count=body.count,
    )
    return DistractorsResponse(options=options)


@router.post(
    "/problems/answers/explanation",
    response_model=ExplanationResponse,
)
async def generate_explanation_api(
    body: ExplanationRequest,
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    from app.modules.problems.application.llm_explanation import generate_explanation

    explanation = await generate_explanation(
        question=body.question,
        correct_answer=body.correct_answer,
        choices=body.choices or None,
    )
    return ExplanationResponse(explanation=explanation)


@router.post(
    "/problems/{problem_id}/video",
    response_model=VideoJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_video_job(
    problem_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    """Создать задачу генерации видео по конкретной задаче с использованием RAG-сценария."""

    from app.modules.video_jobs.application.service import VideoJobService

    video_svc = VideoJobService(session)
    job = await video_svc.create_problem_video_job(problem_id)
    return VideoJobResponse(job_id=job.id, status=job.status)


@router.post(
    "/problems/images/presign",
    response_model=PresignResponse,
)
async def presign_image_upload(
    body: PresignRequest,
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    from app.modules.problems.infra.s3 import (
        ALLOWED_CONTENT_TYPES,
        generate_presigned_upload,
    )
    from app.core.errors import BadRequest

    if body.content_type not in ALLOWED_CONTENT_TYPES:
        raise BadRequest(
            f"Недопустимый тип файла. Разрешены: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}"
        )
    result = generate_presigned_upload(
        problem_id=body.problem_id,
        content_type=body.content_type,
        file_name=body.file_name,
    )
    return PresignResponse(**result)


def to_problem_out(problem) -> ProblemOut:
    return ProblemOut(
        id=problem.id,
        subject_id=problem.subject_id,
        topic_id=problem.topic_id,
        type=problem.type,
        difficulty=problem.difficulty,
        title=problem.title,
        statement=problem.statement,
        explanation=problem.explanation,
        time_limit_sec=problem.time_limit_sec,
        points=problem.points,
        choices=[
            {
                "id": c.id,
                "choice_text": c.choice_text,
                "is_correct": c.is_correct,
                "order_no": c.order_no,
            }
            for c in sorted(problem.choices, key=lambda x: x.order_no)
        ],
        tags=[
            {
                "id": m.tag.id,
                "name": m.tag.name,
            }
            for m in problem.tags
        ],
        images=[
            {
                "id": img.id,
                "url": img.url,
                "order_no": img.order_no,
                "alt_text": img.alt_text,
            }
            for img in sorted(problem.images, key=lambda x: x.order_no)
        ],
    )


def to_problem_admin_out(problem) -> ProblemAdminOut:
    base = to_problem_out(problem)
    answer_key = None
    if problem.answer_keys is not None:
        answer_key = {
            "numeric_answer": problem.answer_keys.numeric_answer,
            "text_answer": problem.answer_keys.text_answer,
            "answer_pattern": problem.answer_keys.answer_pattern,
            "tolerance": problem.answer_keys.tolerance,
            "canonical_answer": problem.answer_keys.canonical_answer,
        }
    return ProblemAdminOut(
        **base.model_dump(),
        status=problem.status,
        created_by=problem.created_by,
        created_at=problem.created_at,
        updated_at=problem.updated_at,
        answer_key=answer_key,
    )


@router.get("/problems", response_model=list[ProblemOut])
async def list_public_problems(
    subject_id: uuid.UUID | None = Query(default=None),
    topic_id: uuid.UUID | None = Query(default=None),
    difficulty: ProblemDifficulty | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = ProblemService(session)
    problems = await svc.list_public(
        subject_id=subject_id,
        topic_id=topic_id,
        difficulty=difficulty,
    )
    return [to_problem_out(p) for p in problems]


@router.get("/problems/{problem_id}", response_model=ProblemOut)
async def get_public_problem(
    problem_id: uuid.UUID,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = ProblemService(session)
    problem = await svc.get_public(problem_id)

    activity = ActivityService(session)
    client = request.client
    await activity.log(
        event_type="problem_viewed",
        user_id=current_user.id if current_user else None,
        path=str(request.url.path),
        ip=client.host if client else None,
        user_agent=request.headers.get("user-agent"),
        meta={"problem_id": str(problem_id)},
    )

    return to_problem_out(problem)


@router.post(
    "/problems",
    response_model=ProblemAdminOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_problem(
    body: ProblemCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = ProblemService(session)
    problem = await svc.create_draft_problem(body, created_by=current_user.id)
    return to_problem_admin_out(problem)


@router.patch("/problems/{problem_id}", response_model=ProblemAdminOut)
async def update_problem(
    problem_id: uuid.UUID,
    body: ProblemUpdate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    role_val = getattr(current_user.role, "value", current_user.role)
    allow_pub = role_val in {UserRole.MODERATOR.value, UserRole.ADMIN.value}
    svc = ProblemService(session)
    problem = await svc.update_draft(problem_id, body, allow_published_edit=allow_pub)
    return to_problem_admin_out(problem)


@router.post(
    "/problems/{problem_id}/publish",
    response_model=ProblemAdminOut,
)
async def publish_problem(
    problem_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = ProblemService(session)
    problem = await svc.moderator_publish(problem_id)
    return to_problem_admin_out(problem)


@router.post(
    "/problems/{problem_id}/archive",
    response_model=ProblemAdminOut,
)
async def archive_problem(
    problem_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = ProblemService(session)
    problem = await svc.archive_problem(problem_id)
    return to_problem_admin_out(problem)


@router.delete(
    "/problems/{problem_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_problem(
    problem_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = ProblemService(session)
    await svc.delete_problem(problem_id)
    return None


@router.get("/admin/problems/{problem_id}", response_model=ProblemAdminOut)
async def get_admin_problem(
    problem_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = ProblemService(session)
    problem = await svc.get(problem_id)
    return to_problem_admin_out(problem)


@router.get("/admin/problems", response_model=ProblemAdminListOut)
async def list_all_problems(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    problem_status: ProblemStatus | None = Query(default=None, alias="status"),
    subject_id: uuid.UUID | None = Query(default=None),
    topic_id: uuid.UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = ProblemService(session)
    offset = (page - 1) * per_page
    problems, total = await svc.list_all(
        status=problem_status,
        subject_id=subject_id,
        topic_id=topic_id,
        offset=offset,
        limit=per_page,
    )
    return ProblemAdminListOut(
        items=[to_problem_admin_out(p) for p in problems],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post(
    "/problems/{problem_id}/submit-review",
    response_model=ProblemAdminOut,
)
async def submit_for_review(
    problem_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = ProblemService(session)
    problem = await svc.submit_for_review(problem_id)
    return to_problem_admin_out(problem)


@router.post(
    "/problems/{problem_id}/reject",
    response_model=ProblemAdminOut,
)
async def reject_problem(
    problem_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = ProblemService(session)
    problem = await svc.reject_problem(problem_id)
    return to_problem_admin_out(problem)


@router.post(
    "/admin/problems/generate-from-rag",
    response_model=GenerateFromRagResponse,
)
async def generate_problems_from_rag(
    body: GenerateFromRagRequest,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    # Определяем желаемые квоты по сложностям, если они заданы.
    easy = body.easy_count or 0
    medium = body.medium_count or 0
    hard = body.hard_count or 0

    difficulty_quota: dict[str, int] | None = None

    # Сначала определяем базовое желаемое количество задач с учётом общего лимита.
    total_requested = min(max(body.count, 1), 30)

    sum_by_levels = easy + medium + hard
    if sum_by_levels > 0:
        # Если пользователь указал количества по уровням сложности,
        # используем их сумму как целевое количество задач (также ограниченную 30).
        total_requested = min(sum_by_levels, 30)
        difficulty_quota = {
            "easy": max(0, min(easy, 30)),
            "medium": max(0, min(medium, 30)),
            "hard": max(0, min(hard, 30)),
        }
    else:
        # Если явных квот нет, распределяем count примерно поровну:
        # сначала лёгкие, затем средние, затем сложные.
        base = total_requested // 3
        rem = total_requested % 3
        easy_auto = base + (1 if rem > 0 else 0)
        medium_auto = base + (1 if rem > 1 else 0)
        hard_auto = base

        difficulty_quota = {
            "easy": easy_auto,
            "medium": medium_auto,
            "hard": hard_auto,
        }

    svc = ProblemService(session)
    problems, skipped_duplicates = await svc.generate_from_rag(
        subject_id=body.subject_id,
        topic_id=body.topic_id,
        count=total_requested,
        created_by=current_user.id,
        difficulty_quota=difficulty_quota,
    )
    return GenerateFromRagResponse(
        items=[to_problem_admin_out(p) for p in problems],
        created_count=len(problems),
        skipped_duplicates=skipped_duplicates,
    )
