from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session, SessionLocal
from app.modules.auth.deps import get_current_user, require_roles
from app.modules.lessons.application.service import LessonService
from app.modules.lessons.api.schemas import (
    ContentBlockCreate,
    ContentBlockOut,
    ContentBlockUpdate,
    LessonCreate,
    LessonCreateIn,
    LessonDetailOut,
    LessonGenerateDraftAcceptedOut,
    LessonGenerateProblemsAcceptedOut,
    LessonGenerateProblemsIn,
    LessonOut,
    LessonProgressOut,
    LessonUpdate,
)
from app.modules.users.data.models import UserRole


async def _run_generate_problems(
    lesson_id: uuid.UUID,
    count: int,
    created_by: uuid.UUID | None,
    allow_published_edit: bool,
) -> None:
    """Фоновая задача: генерация задач по уроку в отдельной сессии."""
    async with SessionLocal() as session:
        svc = LessonService(session)
        await svc.generate_problems_from_rag(
            lesson_id,
            count=count,
            created_by=created_by,
            allow_published_edit=allow_published_edit,
        )


async def _run_generate_draft(
    lesson_id: uuid.UUID,
    allow_published_edit: bool,
) -> None:
    """Фоновая задача: генерация черновика лекции. Исключения логируем, не пробрасываем —
    ответ 202 уже отправлен клиенту."""
    logger = logging.getLogger(__name__)
    try:
        async with SessionLocal() as session:
            svc = LessonService(session)
            await svc.generate_draft(
                lesson_id,
                allow_published_edit=allow_published_edit,
            )
    except Exception as exc:
        logger.exception(
            "generate_draft failed for lesson_id=%s: %s",
            lesson_id,
            exc,
        )


router = APIRouter(tags=["lessons"])


def _is_privileged_lesson_viewer(role: object) -> bool:
    role_value = getattr(role, "value", role)
    return role_value in {
        UserRole.CONTENT_MAKER.value,
        UserRole.MODERATOR.value,
        UserRole.ADMIN.value,
    }


def _can_edit_published(role: object) -> bool:
    role_value = getattr(role, "value", role)
    return role_value in {UserRole.MODERATOR.value, UserRole.ADMIN.value}


@router.get(
    "/topics/{topic_id}/lessons",
    response_model=list[LessonOut],
)
async def list_lessons_for_topic(
    topic_id: uuid.UUID,
    admin_view: bool = Query(default=False),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = LessonService(session)
    is_admin_panel_view = admin_view and _is_privileged_lesson_viewer(current_user.role)
    return await svc.list_for_topic(
        topic_id,
        only_published=not is_admin_panel_view,
    )


@router.post(
    "/topics/{topic_id}/lessons",
    response_model=LessonOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_lesson(
    topic_id: uuid.UUID,
    body: LessonCreateIn,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(UserRole.CONTENT_MAKER, UserRole.MODERATOR, UserRole.ADMIN)
    ),
):
    svc = LessonService(session)
    payload = LessonCreate(
        topic_id=topic_id,
        title=body.title,
        order_no=body.order_no,
    )
    return await svc.create(payload)


@router.get(
    "/lessons/{lesson_id}",
    response_model=LessonDetailOut,
)
async def get_lesson_detail(
    lesson_id: uuid.UUID,
    admin_view: bool = Query(default=False),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = LessonService(session)
    is_admin_panel_view = admin_view and _is_privileged_lesson_viewer(current_user.role)
    return await svc.get_detail(
        lesson_id,
        only_published=not is_admin_panel_view,
    )


@router.patch(
    "/lessons/{lesson_id}",
    response_model=LessonOut,
)
async def update_lesson(
    lesson_id: uuid.UUID,
    body: LessonUpdate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(UserRole.CONTENT_MAKER, UserRole.MODERATOR, UserRole.ADMIN)
    ),
):
    svc = LessonService(session)
    return await svc.update(
        lesson_id, body, allow_published_edit=_can_edit_published(current_user.role)
    )


@router.delete(
    "/lessons/{lesson_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_lesson(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(UserRole.CONTENT_MAKER, UserRole.MODERATOR, UserRole.ADMIN)
    ),
):
    svc = LessonService(session)
    await svc.delete(lesson_id)
    return None


@router.post(
    "/lessons/{lesson_id}/submit-review",
    response_model=LessonOut,
)
async def submit_lesson_for_review(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(UserRole.CONTENT_MAKER, UserRole.MODERATOR, UserRole.ADMIN)
    ),
):
    svc = LessonService(session)
    return await svc.submit_for_review(lesson_id)


@router.post(
    "/lessons/{lesson_id}/publish",
    response_model=LessonOut,
)
async def publish_lesson(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.MODERATOR, UserRole.ADMIN)),
):
    svc = LessonService(session)
    return await svc.publish(lesson_id)


@router.post(
    "/lessons/{lesson_id}/reject",
    response_model=LessonOut,
)
async def reject_lesson(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.MODERATOR, UserRole.ADMIN)),
):
    svc = LessonService(session)
    return await svc.reject(lesson_id)


@router.post(
    "/lessons/{lesson_id}/generate-draft",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=LessonGenerateDraftAcceptedOut,
)
async def generate_lesson_draft(
    lesson_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user=Depends(
        require_roles(UserRole.CONTENT_MAKER, UserRole.MODERATOR, UserRole.ADMIN)
    ),
):
    """Запускает генерацию черновика лекции в фоне; ответ 202 без ожидания завершения."""
    background_tasks.add_task(
        _run_generate_draft,
        lesson_id,
        _can_edit_published(current_user.role),
    )
    return LessonGenerateDraftAcceptedOut()


@router.post(
    "/lessons/{lesson_id}/generate-problems",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=LessonGenerateProblemsAcceptedOut,
)
async def generate_lesson_problems(
    lesson_id: uuid.UUID,
    body: LessonGenerateProblemsIn,
    background_tasks: BackgroundTasks,
    current_user=Depends(
        require_roles(UserRole.CONTENT_MAKER, UserRole.MODERATOR, UserRole.ADMIN)
    ),
):
    """Запускает генерацию задач в фоне; ответ 202 без ожидания завершения."""
    background_tasks.add_task(
        _run_generate_problems,
        lesson_id,
        body.count,
        current_user.id,
        _can_edit_published(current_user.role),
    )
    return LessonGenerateProblemsAcceptedOut()


@router.post(
    "/lessons/{lesson_id}/archive",
    response_model=LessonOut,
)
async def archive_lesson(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.MODERATOR, UserRole.ADMIN)),
):
    svc = LessonService(session)
    return await svc.archive(lesson_id)


# ------------------------------------------------------------------
# Content blocks
# ------------------------------------------------------------------


@router.post(
    "/lessons/{lesson_id}/blocks",
    response_model=ContentBlockOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_content_block(
    lesson_id: uuid.UUID,
    body: ContentBlockCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(UserRole.CONTENT_MAKER, UserRole.MODERATOR, UserRole.ADMIN)
    ),
):
    svc = LessonService(session)
    return await svc.create_block(
        lesson_id, body, allow_published_edit=_can_edit_published(current_user.role)
    )


@router.patch(
    "/blocks/{block_id}",
    response_model=ContentBlockOut,
)
async def update_content_block(
    block_id: uuid.UUID,
    body: ContentBlockUpdate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(UserRole.CONTENT_MAKER, UserRole.MODERATOR, UserRole.ADMIN)
    ),
):
    svc = LessonService(session)
    return await svc.update_block(
        block_id, body, allow_published_edit=_can_edit_published(current_user.role)
    )


@router.delete(
    "/blocks/{block_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_content_block(
    block_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(UserRole.CONTENT_MAKER, UserRole.MODERATOR, UserRole.ADMIN)
    ),
):
    svc = LessonService(session)
    await svc.delete_block(
        block_id, allow_published_edit=_can_edit_published(current_user.role)
    )
    return None


@router.post(
    "/lessons/{lesson_id}/complete",
    response_model=LessonProgressOut,
)
async def mark_lesson_completed(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = LessonService(session)
    return await svc.mark_completed(current_user.id, lesson_id)


@router.get(
    "/topics/{topic_id}/progress",
    response_model=list[LessonProgressOut],
)
async def get_topic_progress(
    topic_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = LessonService(session)
    lessons = await svc.list_for_topic(topic_id, only_published=True)
    lesson_ids = [l.id for l in lessons]
    return await svc.get_progress(current_user.id, lesson_ids)
