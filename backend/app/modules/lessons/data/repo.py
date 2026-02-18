from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFound
from app.core.i18n import tr
from app.modules.lessons.data.models import (
    BlockProblemMapModel,
    BlockType,
    LessonContentBlockModel,
    LessonModel,
    LessonProblemMapModel,
    LessonProgressModel,
)


class LessonsRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_lesson(
        self,
        *,
        topic_id: uuid.UUID,
        title: str,
        order_no: int = 0,
    ) -> LessonModel:
        row = LessonModel(topic_id=topic_id, title=title, order_no=order_no)
        self.session.add(row)
        await self.session.flush()
        return row

    async def get_lesson(self, lesson_id: uuid.UUID) -> LessonModel:
        row = await self.session.get(LessonModel, lesson_id)
        if not row:
            raise NotFound(tr("lesson_not_found"))
        return row

    async def get_lesson_with_blocks(self, lesson_id: uuid.UUID) -> LessonModel:
        stmt = (
            select(LessonModel)
            .where(LessonModel.id == lesson_id)
            .options(
                selectinload(LessonModel.content_blocks).selectinload(
                    LessonContentBlockModel.problem_links
                )
            )
        )
        result = await self.session.execute(stmt)
        row = result.scalar_one_or_none()
        if not row:
            raise NotFound(tr("lesson_not_found"))
        return row

    async def list_lessons_for_topic(self, topic_id: uuid.UUID) -> list[LessonModel]:
        stmt = (
            select(LessonModel)
            .where(LessonModel.topic_id == topic_id)
            .order_by(LessonModel.order_no, LessonModel.created_at)
        )
        rows: Sequence[LessonModel] = (await self.session.execute(stmt)).scalars().all()
        return list(rows)

    async def update_lesson(
        self,
        lesson_id: uuid.UUID,
        *,
        title: str | None = None,
        order_no: int | None = None,
    ) -> LessonModel:
        row = await self.get_lesson(lesson_id)
        if title is not None:
            row.title = title
        if order_no is not None:
            row.order_no = order_no
        await self.session.flush()
        return row

    async def delete_lesson(self, lesson_id: uuid.UUID) -> None:
        row = await self.get_lesson(lesson_id)
        await self.session.delete(row)
        await self.session.flush()

    async def create_content_block(
        self,
        *,
        lesson_id: uuid.UUID,
        block_type: BlockType,
        order_no: int = 0,
        title: str | None = None,
        body: str | None = None,
        video_url: str | None = None,
        video_description: str | None = None,
    ) -> LessonContentBlockModel:
        row = LessonContentBlockModel(
            lesson_id=lesson_id,
            block_type=block_type,
            order_no=order_no,
            title=title,
            body=body,
            video_url=video_url,
            video_description=video_description,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def get_content_block(self, block_id: uuid.UUID) -> LessonContentBlockModel:
        row = await self.session.get(LessonContentBlockModel, block_id)
        if not row:
            raise NotFound(tr("content_block_not_found"))
        return row

    async def update_content_block(
        self,
        block_id: uuid.UUID,
        *,
        order_no: int | None = None,
        title: str | None = None,
        body: str | None = None,
        video_url: str | None = None,
        video_description: str | None = None,
    ) -> LessonContentBlockModel:
        row = await self.get_content_block(block_id)
        if order_no is not None:
            row.order_no = order_no
        if title is not None:
            row.title = title
        if body is not None:
            row.body = body
        if video_url is not None:
            row.video_url = video_url
        if video_description is not None:
            row.video_description = video_description
        await self.session.flush()
        return row

    async def delete_content_block(self, block_id: uuid.UUID) -> None:
        row = await self.get_content_block(block_id)
        await self.session.delete(row)
        await self.session.flush()

    async def set_block_problems(
        self,
        block_id: uuid.UUID,
        problem_ids: list[uuid.UUID],
    ) -> None:      
        stmt = select(BlockProblemMapModel).where(
            BlockProblemMapModel.content_block_id == block_id
        )
        existing = (await self.session.execute(stmt)).scalars().all()
        for row in existing:
            await self.session.delete(row)
        await self.session.flush()

        for idx, pid in enumerate(problem_ids):
            self.session.add(
                BlockProblemMapModel(
                    content_block_id=block_id,
                    problem_id=pid,
                    order_no=idx,
                )
            )
        await self.session.flush()

    async def list_block_problem_ids(self, block_id: uuid.UUID) -> list[uuid.UUID]:
        stmt = (
            select(BlockProblemMapModel)
            .where(BlockProblemMapModel.content_block_id == block_id)
            .order_by(BlockProblemMapModel.order_no)
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return [r.problem_id for r in rows]

    async def list_problem_ids_for_lesson(self, lesson_id: uuid.UUID) -> list[uuid.UUID]:
        stmt = (
            select(LessonProblemMapModel)
            .where(LessonProblemMapModel.lesson_id == lesson_id)
            .order_by(LessonProblemMapModel.order_no)
        )
        rows: Sequence[LessonProblemMapModel] = (
            await self.session.execute(stmt)
        ).scalars().all()
        return [row.problem_id for row in rows]

    async def get_progress(
        self, user_id: uuid.UUID, lesson_id: uuid.UUID
    ) -> LessonProgressModel | None:
        stmt = select(LessonProgressModel).where(
            LessonProgressModel.user_id == user_id,
            LessonProgressModel.lesson_id == lesson_id,
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def mark_lesson_completed(
        self,
        user_id: uuid.UUID,
        lesson_id: uuid.UUID,
        time_spent_sec: int | None = None,
    ) -> LessonProgressModel:
        existing = await self.get_progress(user_id, lesson_id)
        if existing:
            existing.completed = True
            if time_spent_sec is not None:
                existing.time_spent_sec = time_spent_sec
            await self.session.flush()
            return existing

        row = LessonProgressModel(
            user_id=user_id,
            lesson_id=lesson_id,
            completed=True,
            time_spent_sec=time_spent_sec,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def list_progress_for_user(
        self, user_id: uuid.UUID, lesson_ids: list[uuid.UUID] | None = None
    ) -> list[LessonProgressModel]:
        stmt = select(LessonProgressModel).where(
            LessonProgressModel.user_id == user_id
        )
        if lesson_ids is not None:
            stmt = stmt.where(LessonProgressModel.lesson_id.in_(lesson_ids))
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows)
