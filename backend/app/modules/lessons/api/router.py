from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.modules.auth.deps import get_current_user, require_roles
from app.modules.lessons.application.service import LessonService
from app.modules.lessons.api.schemas import (
    ContentBlockCreate,
    ContentBlockOut,
    ContentBlockUpdate,
    LessonCreate,
    LessonCreateIn,
    LessonDetailOut,
    LessonOut,
    LessonProgressOut,
    LessonUpdate,
)
from app.modules.users.data.models import UserRole


router = APIRouter(tags=["lessons"])


def _is_privileged_lesson_viewer(role: object) -> bool:
    role_value = getattr(role, "value", role)
    return role_value in {
        UserRole.CONTENT_MAKER.value,
        UserRole.MODERATOR.value,
        UserRole.ADMIN.value,
    }


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
    return await svc.update(lesson_id, body)


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
    return await svc.create_block(lesson_id, body)


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
    return await svc.update_block(block_id, body)


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
    await svc.delete_block(block_id)
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
