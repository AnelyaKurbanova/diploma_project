from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.lessons.api.schemas import (
    ContentBlockCreate,
    ContentBlockOut,
    ContentBlockProblemOut,
    ContentBlockUpdate,
    LessonCreate,
    LessonDetailOut,
    LessonOut,
    LessonProgressOut,
    LessonUpdate,
)
from app.modules.lessons.data.models import BlockType
from app.modules.lessons.data.repo import LessonsRepo


class LessonService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = LessonsRepo(session)

    # ------------------------------------------------------------------
    # Lessons CRUD
    # ------------------------------------------------------------------

    async def create(self, data: LessonCreate) -> LessonOut:
        row = await self.repo.create_lesson(
            topic_id=data.topic_id,
            title=data.title,
            order_no=data.order_no,
        )
        await self.session.commit()
        return LessonOut(
            id=row.id,
            topic_id=row.topic_id,
            title=row.title,
            order_no=row.order_no,
            created_at=row.created_at,
        )

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
        lesson = await self.repo.get_lesson_with_blocks(lesson_id)
        legacy_problem_ids = await self.repo.list_problem_ids_for_lesson(lesson_id)

        blocks_out: list[ContentBlockOut] = []
        for block in lesson.content_blocks:
            problems = [
                ContentBlockProblemOut(problem_id=link.problem_id, order_no=link.order_no)
                for link in block.problem_links
            ]
            blocks_out.append(
                ContentBlockOut(
                    id=block.id,
                    block_type=block.block_type.value,
                    order_no=block.order_no,
                    title=block.title,
                    body=block.body,
                    video_url=block.video_url,
                    video_description=block.video_description,
                    problems=problems,
                    created_at=block.created_at,
                    updated_at=block.updated_at,
                )
            )

        return LessonDetailOut(
            id=lesson.id,
            topic_id=lesson.topic_id,
            title=lesson.title,
            order_no=lesson.order_no,
            created_at=lesson.created_at,
            theory_body=lesson.theory_body,
            problem_ids=legacy_problem_ids,
            content_blocks=blocks_out,
        )

    async def update(self, lesson_id: uuid.UUID, data: LessonUpdate) -> LessonOut:
        row = await self.repo.update_lesson(
            lesson_id,
            title=data.title,
            order_no=data.order_no,
        )
        await self.session.commit()
        return LessonOut(
            id=row.id,
            topic_id=row.topic_id,
            title=row.title,
            order_no=row.order_no,
            created_at=row.created_at,
        )

    async def delete(self, lesson_id: uuid.UUID) -> None:
        await self.repo.delete_lesson(lesson_id)
        await self.session.commit()

    # ------------------------------------------------------------------
    # Content blocks CRUD
    # ------------------------------------------------------------------

    async def create_block(
        self, lesson_id: uuid.UUID, data: ContentBlockCreate
    ) -> ContentBlockOut:
        block = await self.repo.create_content_block(
            lesson_id=lesson_id,
            block_type=BlockType(data.block_type),
            order_no=data.order_no,
            title=data.title,
            body=data.body,
            video_url=data.video_url,
            video_description=data.video_description,
        )
        if data.problem_ids and data.block_type == "problem_set":
            await self.repo.set_block_problems(block.id, data.problem_ids)

        await self.session.commit()

        problem_ids = (
            await self.repo.list_block_problem_ids(block.id)
            if data.block_type == "problem_set"
            else []
        )
        return ContentBlockOut(
            id=block.id,
            block_type=block.block_type.value,
            order_no=block.order_no,
            title=block.title,
            body=block.body,
            video_url=block.video_url,
            video_description=block.video_description,
            problems=[
                ContentBlockProblemOut(problem_id=pid, order_no=idx)
                for idx, pid in enumerate(problem_ids)
            ],
            created_at=block.created_at,
            updated_at=block.updated_at,
        )

    async def update_block(
        self, block_id: uuid.UUID, data: ContentBlockUpdate
    ) -> ContentBlockOut:
        block = await self.repo.update_content_block(
            block_id,
            order_no=data.order_no,
            title=data.title,
            body=data.body,
            video_url=data.video_url,
            video_description=data.video_description,
        )
        if data.problem_ids is not None and block.block_type == BlockType.PROBLEM_SET:
            await self.repo.set_block_problems(block.id, data.problem_ids)

        await self.session.commit()

        problem_ids = await self.repo.list_block_problem_ids(block.id)
        return ContentBlockOut(
            id=block.id,
            block_type=block.block_type.value,
            order_no=block.order_no,
            title=block.title,
            body=block.body,
            video_url=block.video_url,
            video_description=block.video_description,
            problems=[
                ContentBlockProblemOut(problem_id=pid, order_no=idx)
                for idx, pid in enumerate(problem_ids)
            ],
            created_at=block.created_at,
            updated_at=block.updated_at,
        )

    async def delete_block(self, block_id: uuid.UUID) -> None:
        await self.repo.delete_content_block(block_id)
        await self.session.commit()

    # ------------------------------------------------------------------
    # Progress
    # ------------------------------------------------------------------

    async def mark_completed(
        self,
        user_id: uuid.UUID,
        lesson_id: uuid.UUID,
        time_spent_sec: int | None = None,
    ) -> LessonProgressOut:
        row = await self.repo.mark_lesson_completed(user_id, lesson_id, time_spent_sec)
        await self.session.commit()
        return LessonProgressOut(
            user_id=row.user_id,
            lesson_id=row.lesson_id,
            completed=row.completed,
            completed_at=row.completed_at,
            time_spent_sec=row.time_spent_sec,
        )

    async def get_progress(
        self,
        user_id: uuid.UUID,
        lesson_ids: list[uuid.UUID] | None = None,
    ) -> list[LessonProgressOut]:
        rows = await self.repo.list_progress_for_user(user_id, lesson_ids)
        return [
            LessonProgressOut(
                user_id=r.user_id,
                lesson_id=r.lesson_id,
                completed=r.completed,
                completed_at=r.completed_at,
                time_spent_sec=r.time_spent_sec,
            )
            for r in rows
        ]
