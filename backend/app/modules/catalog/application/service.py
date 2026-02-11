from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.catalog.data.repo import CatalogRepo
from app.modules.catalog.data.models import SubjectModel, TopicModel
from app.modules.catalog.api.schemas import (
    SubjectCreate,
    SubjectUpdate,
    TopicCreate,
    TopicUpdate,
)


class SubjectService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = CatalogRepo(session)

    async def create(self, data: SubjectCreate) -> SubjectModel:
        row = await self.repo.create_subject(
            code=data.code,
            name_ru=data.name_ru,
            name_kk=data.name_kk,
            name_en=data.name_en,
            description_ru=data.description_ru,
            description_kk=data.description_kk,
            description_en=data.description_en,
        )
        await self.session.commit()
        return row

    async def get(self, subject_id: uuid.UUID) -> SubjectModel:
        return await self.repo.get_subject(subject_id)

    async def get_with_topic_count(self, subject_id: uuid.UUID) -> tuple[SubjectModel, int]:
        return await self.repo.get_subject_with_topic_count(subject_id)

    async def list(self) -> list[SubjectModel]:
        return await self.repo.list_subjects()

    async def list_with_topic_counts(self) -> list[tuple[SubjectModel, int]]:
        return await self.repo.list_subjects_with_topic_counts()

    async def update(self, subject_id: uuid.UUID, data: SubjectUpdate) -> SubjectModel:
        row = await self.repo.update_subject(
            subject_id,
            code=data.code,
            name_ru=data.name_ru,
            name_kk=data.name_kk,
            name_en=data.name_en,
            description_ru=data.description_ru,
            description_kk=data.description_kk,
            description_en=data.description_en,
        )
        await self.session.commit()
        return row

    async def delete(self, subject_id: uuid.UUID) -> None:
        await self.repo.delete_subject(subject_id)
        await self.session.commit()


class TopicService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = CatalogRepo(session)

    async def create(self, data: TopicCreate) -> TopicModel:
        row = await self.repo.create_topic(
            subject_id=data.subject_id,
            parent_topic_id=data.parent_topic_id,
            title_ru=data.title_ru,
            title_kk=data.title_kk,
            title_en=data.title_en,
            grade_level=data.grade_level,
            order_no=data.order_no,
        )
        await self.session.commit()
        return row

    async def get(self, topic_id: uuid.UUID) -> TopicModel:
        return await self.repo.get_topic(topic_id)

    async def list(
        self,
        *,
        subject_id: uuid.UUID | None = None,
        parent_topic_id: uuid.UUID | None = None,
        grade_level: int | None = None,
    ) -> list[TopicModel]:
        return await self.repo.list_topics(
            subject_id=subject_id,
            parent_topic_id=parent_topic_id,
            grade_level=grade_level,
        )

    async def update(self, topic_id: uuid.UUID, data: TopicUpdate) -> TopicModel:
        row = await self.repo.update_topic(
            topic_id,
            subject_id=data.subject_id,
            parent_topic_id=data.parent_topic_id,
            title_ru=data.title_ru,
            title_kk=data.title_kk,
            title_en=data.title_en,
            grade_level=data.grade_level,
            order_no=data.order_no,
        )
        await self.session.commit()
        return row

    async def delete(self, topic_id: uuid.UUID) -> None:
        await self.repo.delete_topic(topic_id)
        await self.session.commit()
