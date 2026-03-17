from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import CacheService, NAMESPACE, get_cache_service
from app.modules.catalog.data.repo import CatalogRepo
from app.modules.catalog.data.models import SubjectModel, TopicModel
from app.modules.catalog.api.schemas import (
    SubjectCreate,
    SubjectUpdate,
    TopicCreate,
    TopicUpdate,
)


class SubjectService:
    def __init__(
        self,
        session: AsyncSession,
        cache: CacheService | None = None,
    ) -> None:
        self.session = session
        self.repo = CatalogRepo(session)
        self.cache = cache or get_cache_service()

    async def create(self, data: SubjectCreate) -> SubjectModel:
        row = await self.repo.create_subject(
            code=data.code,
            name_ru=data.name_ru,
            name_kk=data.name_kk,
            name_en=data.name_en,
        )
        await self.session.commit()
        return row

    async def get(self, subject_id: uuid.UUID) -> SubjectModel:
        cache_key = f"{NAMESPACE.catalog_subjects}:{subject_id}"

        async def _load() -> SubjectModel:
            return await self.repo.get_subject(subject_id)

        return await self.cache.get_or_set(cache_key, _load)

    async def get_with_topic_count(self, subject_id: uuid.UUID) -> tuple[SubjectModel, int]:
        cache_key = f"{NAMESPACE.catalog_subjects}:{subject_id}:with_topic_count"

        async def _load() -> tuple[SubjectModel, int]:
            return await self.repo.get_subject_with_topic_count(subject_id)

        return await self.cache.get_or_set(cache_key, _load)

    async def list(self) -> list[SubjectModel]:
        cache_key = f"{NAMESPACE.catalog_subjects}:all"

        async def _load() -> list[SubjectModel]:
            return await self.repo.list_subjects()

        return await self.cache.get_or_set(cache_key, _load)

    async def list_with_topic_counts(self) -> list[tuple[SubjectModel, int]]:
        cache_key = f"{NAMESPACE.catalog_subjects}:all_with_topic_counts"

        async def _load() -> list[tuple[SubjectModel, int]]:
            return await self.repo.list_subjects_with_topic_counts()

        return await self.cache.get_or_set(cache_key, _load)

    async def update(self, subject_id: uuid.UUID, data: SubjectUpdate) -> SubjectModel:
        row = await self.repo.update_subject(
            subject_id,
            code=data.code,
            name_ru=data.name_ru,
            name_kk=data.name_kk,
            name_en=data.name_en,
        )
        await self.session.commit()

        await self.cache.invalidate_pattern(f"{NAMESPACE.catalog_subjects}:*")
        await self.cache.invalidate_pattern(f"{NAMESPACE.catalog_topics}:*")
        await self.cache.invalidate_pattern(f"{NAMESPACE.catalog_problems}:*")

        return row

    async def delete(self, subject_id: uuid.UUID) -> None:
        await self.repo.delete_subject(subject_id)
        await self.session.commit()

        await self.cache.invalidate_pattern(f"{NAMESPACE.catalog_subjects}:*")
        await self.cache.invalidate_pattern(f"{NAMESPACE.catalog_topics}:*")
        await self.cache.invalidate_pattern(f"{NAMESPACE.catalog_problems}:*")


class TopicService:
    def __init__(
        self,
        session: AsyncSession,
        cache: CacheService | None = None,
    ) -> None:
        self.session = session
        self.repo = CatalogRepo(session)
        self.cache = cache or get_cache_service()

    async def create(self, data: TopicCreate) -> TopicModel:
        row = await self.repo.create_topic(
            subject_id=data.subject_id,
            title_ru=data.title_ru,
            title_kk=data.title_kk,
            title_en=data.title_en,
            parent_topic_id=None,
            grade_level=data.grade_level,
            order_no=0,
        )
        await self.session.commit()
        return row

    async def get(self, topic_id: uuid.UUID) -> TopicModel:
        cache_key = f"{NAMESPACE.catalog_topics}:{topic_id}"

        async def _load() -> TopicModel:
            return await self.repo.get_topic(topic_id)

        return await self.cache.get_or_set(cache_key, _load)

    async def list(
        self,
        *,
        subject_id: uuid.UUID | None = None,
        parent_topic_id: uuid.UUID | None = None,
        grade_level: int | None = None,
    ) -> list[TopicModel]:
        cache_key_parts: list[str] = [NAMESPACE.catalog_topics, "list"]
        if subject_id is not None:
            cache_key_parts.append(f"subject={subject_id}")
        if parent_topic_id is not None:
            cache_key_parts.append(f"parent={parent_topic_id}")
        if grade_level is not None:
            cache_key_parts.append(f"grade={grade_level}")
        cache_key = ":".join(cache_key_parts)

        async def _load() -> list[TopicModel]:
            return await self.repo.list_topics(
                subject_id=subject_id,
                parent_topic_id=parent_topic_id,
                grade_level=grade_level,
            )

        return await self.cache.get_or_set(cache_key, _load)

    async def update(self, topic_id: uuid.UUID, data: TopicUpdate) -> TopicModel:
        row = await self.repo.update_topic(
            topic_id,
            title_ru=data.title_ru,
            title_kk=data.title_kk,
            title_en=data.title_en,
            subject_id=None,
            parent_topic_id=None,
            grade_level=data.grade_level,
            order_no=None,
        )
        await self.session.commit()

        await self.cache.invalidate_pattern(f"{NAMESPACE.catalog_topics}:*")
        await self.cache.invalidate_pattern(f"{NAMESPACE.catalog_problems}:*")

        return row

    async def delete(self, topic_id: uuid.UUID) -> None:
        await self.repo.delete_topic(topic_id)
        await self.session.commit()

        await self.cache.invalidate_pattern(f"{NAMESPACE.catalog_topics}:*")
        await self.cache.invalidate_pattern(f"{NAMESPACE.catalog_problems}:*")


class CurriculumService:
    """Service for grade-based navigation over subjects, topics, and lessons."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = CatalogRepo(session)

    async def list_grades_for_subject(self, subject_code: str) -> list[int]:
        return await self.repo.list_distinct_grades_for_subject(subject_code)

    async def list_topics_for_subject_and_grade(
        self,
        subject_code: str,
        grade_level: int,
    ) -> list[TopicModel]:
        return await self.repo.list_topics_for_subject_and_grade(
            subject_code=subject_code,
            grade_level=grade_level,
        )
