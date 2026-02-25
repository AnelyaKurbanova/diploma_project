from __future__ import annotations

import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound
from app.core.i18n import tr
from app.modules.catalog.data.repo import CatalogRepo
from app.modules.knowledge.application.retrieval import search as knowledge_search
from app.modules.lessons.application.llm_lecture import generate_lecture_from_context
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
from app.modules.lessons.data.models import BlockType, LessonStatus
from app.modules.lessons.data.repo import LessonsRepo


class LessonService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = LessonsRepo(session)

    async def create(self, data: LessonCreate) -> LessonOut:
        if not await self.repo.topic_exists(data.topic_id):
            raise NotFound(tr("topic_not_found"))

        existing = await self.repo.get_first_lesson_for_topic(data.topic_id)
        if existing is not None:
            raise Conflict("For each topic only one lesson is allowed")

        try:
            row = await self.repo.create_lesson(
                topic_id=data.topic_id,
                title=data.title,
                order_no=data.order_no,
            )
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            # Convert raw DB-level violations to a stable API error for client.
            raise Conflict("Could not create lesson for this topic")
        return LessonOut(
            id=row.id,
            topic_id=row.topic_id,
            title=row.title,
            order_no=row.order_no,
            status=self._lesson_status_to_str(row.status),
            created_at=row.created_at,
        )

    async def list_for_topic(
        self,
        topic_id: uuid.UUID,
        *,
        only_published: bool = False,
    ) -> list[LessonOut]:
        lessons = await self.repo.list_lessons_for_topic(
            topic_id,
            status=LessonStatus.PUBLISHED if only_published else None,
        )
        return [
            LessonOut(
                id=row.id,
                topic_id=row.topic_id,
                title=row.title,
                order_no=row.order_no,
                status=self._lesson_status_to_str(row.status),
                created_at=row.created_at,
            )
            for row in lessons
        ]

    async def get_detail(self, lesson_id: uuid.UUID, *, only_published: bool = False) -> LessonDetailOut:
        lesson = await self.repo.get_lesson_with_blocks(lesson_id)
        if only_published and lesson.status != LessonStatus.PUBLISHED:
            raise NotFound("Lesson not found")
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
                    block_type=self._block_type_to_str(block.block_type),
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
            status=self._lesson_status_to_str(lesson.status),
            created_at=lesson.created_at,
            theory_body=lesson.theory_body,
            problem_ids=legacy_problem_ids,
            content_blocks=blocks_out,
        )

    async def update(
        self, lesson_id: uuid.UUID, data: LessonUpdate, *, allow_published_edit: bool = False
    ) -> LessonOut:
        lesson = await self.repo.get_lesson(lesson_id)
        await self._normalize_editable_status(lesson, allow_published_edit=allow_published_edit)
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
            status=self._lesson_status_to_str(row.status),
            created_at=row.created_at,
        )

    async def delete(self, lesson_id: uuid.UUID) -> None:
        await self.repo.delete_lesson(lesson_id)
        await self.session.commit()

    # ------------------------------------------------------------------
    # Content blocks CRUD
    # ------------------------------------------------------------------

    async def create_block(
        self, lesson_id: uuid.UUID, data: ContentBlockCreate, *, allow_published_edit: bool = False
    ) -> ContentBlockOut:
        lesson = await self.repo.get_lesson(lesson_id)
        await self._normalize_editable_status(lesson, allow_published_edit=allow_published_edit)
        if data.block_type == BlockType.PROBLEM_SET.value:
            if await self.repo.has_block_type(lesson_id, BlockType.PROBLEM_SET):
                raise Conflict("Only one problem_set block is allowed for a lesson")

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
        await self.session.refresh(block)

        problem_ids = (
            await self.repo.list_block_problem_ids(block.id)
            if data.block_type == "problem_set"
            else []
        )
        return ContentBlockOut(
            id=block.id,
            block_type=self._block_type_to_str(block.block_type),
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
        self, block_id: uuid.UUID, data: ContentBlockUpdate, *, allow_published_edit: bool = False
    ) -> ContentBlockOut:
        existing_block = await self.repo.get_content_block(block_id)
        lesson = await self.repo.get_lesson(existing_block.lesson_id)
        await self._normalize_editable_status(lesson, allow_published_edit=allow_published_edit)

        patch = data.model_dump(exclude_unset=True)
        block_field_patch = {
            k: v
            for k, v in patch.items()
            if k in {"order_no", "title", "body", "video_url", "video_description"}
        }
        block = await self.repo.update_content_block(
            block_id,
            **block_field_patch,
        )
        if (
            "problem_ids" in patch
            and self._block_type_to_str(block.block_type) == BlockType.PROBLEM_SET.value
        ):
            await self.repo.set_block_problems(block.id, patch.get("problem_ids") or [])

        await self.session.commit()
        await self.session.refresh(block)

        problem_ids = await self.repo.list_block_problem_ids(block.id)
        return ContentBlockOut(
            id=block.id,
            block_type=self._block_type_to_str(block.block_type),
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

    async def delete_block(self, block_id: uuid.UUID, *, allow_published_edit: bool = False) -> None:
        existing_block = await self.repo.get_content_block(block_id)
        lesson = await self.repo.get_lesson(existing_block.lesson_id)
        await self._normalize_editable_status(lesson, allow_published_edit=allow_published_edit)
        await self.repo.delete_content_block(block_id)
        await self.session.commit()

    async def submit_for_review(self, lesson_id: uuid.UUID) -> LessonOut:
        lesson = await self.repo.get_lesson(lesson_id)
        if lesson.status != LessonStatus.DRAFT:
            raise Conflict("Only draft lessons can be submitted for review")
        row = await self.repo.change_status(lesson_id, status=LessonStatus.PENDING_REVIEW)
        await self.session.commit()
        return LessonOut(
            id=row.id,
            topic_id=row.topic_id,
            title=row.title,
            order_no=row.order_no,
            status=self._lesson_status_to_str(row.status),
            created_at=row.created_at,
        )

    async def publish(self, lesson_id: uuid.UUID) -> LessonOut:
        lesson = await self.repo.get_lesson(lesson_id)
        if lesson.status != LessonStatus.PENDING_REVIEW:
            raise Conflict("Only pending-review lessons can be published")
        row = await self.repo.change_status(lesson_id, status=LessonStatus.PUBLISHED)
        await self.session.commit()
        return LessonOut(
            id=row.id,
            topic_id=row.topic_id,
            title=row.title,
            order_no=row.order_no,
            status=self._lesson_status_to_str(row.status),
            created_at=row.created_at,
        )

    async def reject(self, lesson_id: uuid.UUID) -> LessonOut:
        lesson = await self.repo.get_lesson(lesson_id)
        if lesson.status != LessonStatus.PENDING_REVIEW:
            raise Conflict("Only pending-review lessons can be rejected")
        row = await self.repo.change_status(lesson_id, status=LessonStatus.DRAFT)
        await self.session.commit()
        return LessonOut(
            id=row.id,
            topic_id=row.topic_id,
            title=row.title,
            order_no=row.order_no,
            status=self._lesson_status_to_str(row.status),
            created_at=row.created_at,
        )

    async def archive(self, lesson_id: uuid.UUID) -> LessonOut:
        row = await self.repo.change_status(lesson_id, status=LessonStatus.ARCHIVED)
        await self.session.commit()
        return LessonOut(
            id=row.id,
            topic_id=row.topic_id,
            title=row.title,
            order_no=row.order_no,
            status=self._lesson_status_to_str(row.status),
            created_at=row.created_at,
        )

    async def generate_draft(
        self, lesson_id: uuid.UUID, *, allow_published_edit: bool = False
    ) -> LessonDetailOut:
        lesson = await self.repo.get_lesson_with_blocks(lesson_id)
        await self._normalize_editable_status(lesson, allow_published_edit=allow_published_edit)

        catalog_repo = CatalogRepo(self.session)
        topic = await catalog_repo.get_topic(lesson.topic_id)
        subject = await catalog_repo.get_subject(topic.subject_id)

        chunks = await knowledge_search(
            self.session,
            lesson.title,
            subject_code=subject.code,
            k=12,
        )
        if not chunks:
            raise NotFound("Нет учебных материалов по предмету. Сначала загрузите docx через /knowledge/ingest.")

        chunk_contents = [c.content for c in chunks]
        text = await generate_lecture_from_context(topic.title_ru, chunk_contents)
        if not text:
            raise Conflict("Не удалось сгенерировать лекцию. Проверьте OPENAI_API_KEY.")

        lecture_blocks = [
            b for b in lesson.content_blocks
            if self._block_type_to_str(b.block_type) == BlockType.LECTURE.value
        ]
        lecture_blocks.sort(key=lambda b: b.order_no)

        if lecture_blocks:
            block = lecture_blocks[0]
            await self.repo.update_content_block(block.id, body=text)
        else:
            max_order = max((b.order_no for b in lesson.content_blocks), default=-1)
            await self.repo.create_content_block(
                lesson_id=lesson_id,
                block_type=BlockType.LECTURE,
                order_no=max_order + 1,
                title=lesson.title,
                body=text,
            )

        await self.session.commit()
        return await self.get_detail(lesson_id, only_published=False)

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

    @staticmethod
    def _block_type_to_str(block_type: BlockType | str) -> str:
        return block_type.value if isinstance(block_type, BlockType) else str(block_type)

    @staticmethod
    def _lesson_status_to_str(status: LessonStatus | str) -> str:
        return status.value if isinstance(status, LessonStatus) else str(status)

    async def _normalize_editable_status(
        self, lesson, *, allow_published_edit: bool = False
    ) -> None:
        current_status = self._lesson_status_to_str(lesson.status)
        if not allow_published_edit and current_status not in (
            LessonStatus.DRAFT.value,
            LessonStatus.PENDING_REVIEW.value,
        ):
            raise Conflict("Only draft or pending-review lessons can be edited")
        if current_status == LessonStatus.PENDING_REVIEW.value and not allow_published_edit:
            await self.repo.change_status(lesson.id, status=LessonStatus.DRAFT)
