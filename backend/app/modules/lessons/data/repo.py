from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.modules.lessons.data.models import LessonModel, LessonProblemMapModel


class LessonsRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_lesson(self, lesson_id: uuid.UUID) -> LessonModel:
        row = await self.session.get(LessonModel, lesson_id)
        if not row:
            raise NotFound("Lesson not found")
        return row

    async def list_lessons_for_topic(self, topic_id: uuid.UUID) -> list[LessonModel]:
        stmt: Select[LessonModel] = (
            select(LessonModel)
            .where(LessonModel.topic_id == topic_id)
            .order_by(LessonModel.order_no, LessonModel.created_at)
        )
        rows: Sequence[LessonModel] = (await self.session.execute(stmt)).scalars().all()
        return list(rows)

    async def list_problem_ids_for_lesson(self, lesson_id: uuid.UUID) -> list[uuid.UUID]:
        stmt: Select[LessonProblemMapModel] = (
            select(LessonProblemMapModel)
            .where(LessonProblemMapModel.lesson_id == lesson_id)
            .order_by(LessonProblemMapModel.order_no)
        )
        rows: Sequence[LessonProblemMapModel] = (
            await self.session.execute(stmt)
        ).scalars().all()
        return [row.problem_id for row in rows]

