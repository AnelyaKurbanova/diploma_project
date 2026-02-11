from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
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
from app.modules.users.data.models import UserRole


router = APIRouter(tags=["problems"])


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
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = ProblemService(session)
    problem = await svc.get_public(problem_id)
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
    svc = ProblemService(session)
    problem = await svc.update_draft(problem_id, body)
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

