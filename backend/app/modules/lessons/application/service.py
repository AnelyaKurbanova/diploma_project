from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.lessons.api.schemas import LessonDetailOut, LessonOut
from app.modules.lessons.data.repo import LessonsRepo


class LessonService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = LessonsRepo(session)

    async def list_for_topic(self, topic_id: uuid.UUID) -> list[LessonOut]:
        lessons = await self.repo.list_lessons_for_topic(topic_id)
        return [
            LessonOut(
                id=row.id,
                topic_id=row.topic_id,
                title=row.title,
                order_no=row.order_no,
                created_at=row.created_at,
            )
            for row in lessons
        ]

    async def get_detail(self, lesson_id: uuid.UUID) -> LessonDetailOut:
        lesson = await self.repo.get_lesson(lesson_id)
        problem_ids = await self.repo.list_problem_ids_for_lesson(lesson_id)
        return LessonDetailOut(
            id=lesson.id,
            topic_id=lesson.topic_id,
            title=lesson.title,
            order_no=lesson.order_no,
            created_at=lesson.created_at,
            theory_body=lesson.theory_body,
            problem_ids=problem_ids,
        )

