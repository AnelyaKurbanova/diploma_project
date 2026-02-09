from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.modules.lessons.application.service import LessonService
from app.modules.lessons.api.schemas import LessonDetailOut, LessonOut


router = APIRouter(tags=["lessons"])


@router.get(
    "/topics/{topic_id}/lessons",
    response_model=list[LessonOut],
)
async def list_lessons_for_topic(
    topic_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    List lessons for a given topic, ordered by `order_no` then creation time.
    Public, read-only endpoint usable by the student frontend.
    """
    svc = LessonService(session)
    return await svc.list_for_topic(topic_id)


@router.get(
    "/lessons/{lesson_id}",
    response_model=LessonDetailOut,
)
async def get_lesson_detail(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get a single lesson with theory and ordered problem ids attached to it.
    Frontend can fetch full problem data via existing `/problems/{problem_id}`.
    """
    svc = LessonService(session)
    return await svc.get_detail(lesson_id)

