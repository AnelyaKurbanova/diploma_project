from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound
from app.modules.catalog.data.models import SubjectModel, TopicModel


class CatalogRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_subject(
        self,
        *,
        code: str,
        name_ru: str,
        name_kk: str | None,
        name_en: str | None,
    ) -> SubjectModel:
        row = SubjectModel(
            code=code,
            name_ru=name_ru,
            name_kk=name_kk,
            name_en=name_en,
        )
        self.session.add(row)
        try:
            await self.session.flush()
        except IntegrityError:
            raise Conflict("Subject with this code already exists")
        return row

    async def get_subject(self, subject_id: uuid.UUID) -> SubjectModel:
        row = await self.session.get(SubjectModel, subject_id)
        if not row:
            raise NotFound("Subject not found")
        return row

    async def list_subjects(self) -> list[SubjectModel]:
        stmt: Select[SubjectModel] = select(SubjectModel).order_by(SubjectModel.code)
        rows: Sequence[SubjectModel] = (await self.session.execute(stmt)).scalars().all()
        return list(rows)

    async def update_subject(
        self,
        subject_id: uuid.UUID,
        *,
        code: str | None,
        name_ru: str | None,
        name_kk: str | None,
        name_en: str | None,
    ) -> SubjectModel:
        row = await self.get_subject(subject_id)
        if code is not None:
            row.code = code
        if name_ru is not None:
            row.name_ru = name_ru
        if name_kk is not None:
            row.name_kk = name_kk
        if name_en is not None:
            row.name_en = name_en
        try:
            await self.session.flush()
        except IntegrityError:
            raise Conflict("Subject with this code already exists")
        return row

    async def delete_subject(self, subject_id: uuid.UUID) -> None:
        row = await self.get_subject(subject_id)
        await self.session.delete(row)
        await self.session.flush()

    async def create_topic(
        self,
        *,
        subject_id: uuid.UUID,
        parent_topic_id: uuid.UUID | None,
        title_ru: str,
        title_kk: str | None,
        title_en: str | None,
        grade_level: int | None,
        difficulty_level: int,
        order_no: int,
    ) -> TopicModel:
        row = TopicModel(
            subject_id=subject_id,
            parent_topic_id=parent_topic_id,
            title_ru=title_ru,
            title_kk=title_kk,
            title_en=title_en,
            grade_level=grade_level,
            difficulty_level=difficulty_level,
            order_no=order_no,
        )
        self.session.add(row)
        try:
            await self.session.flush()
        except IntegrityError:
            raise Conflict("Topic with these parameters already exists")
        return row

    async def get_topic(self, topic_id: uuid.UUID) -> TopicModel:
        row = await self.session.get(TopicModel, topic_id)
        if not row:
            raise NotFound("Topic not found")
        return row

    async def list_topics(
        self,
        *,
        subject_id: uuid.UUID | None = None,
        parent_topic_id: uuid.UUID | None = None,
        difficulty_level: int | None = None,
        grade_level: int | None = None,
    ) -> list[TopicModel]:
        stmt: Select[TopicModel] = select(TopicModel).order_by(
            TopicModel.subject_id, TopicModel.order_no, TopicModel.created_at
        )
        if subject_id is not None:
            stmt = stmt.where(TopicModel.subject_id == subject_id)
        if parent_topic_id is not None:
            stmt = stmt.where(TopicModel.parent_topic_id == parent_topic_id)
        if difficulty_level is not None:
            stmt = stmt.where(TopicModel.difficulty_level == difficulty_level)
        if grade_level is not None:
            stmt = stmt.where(TopicModel.grade_level == grade_level)

        rows: Sequence[TopicModel] = (await self.session.execute(stmt)).scalars().all()
        return list(rows)

    async def update_topic(
        self,
        topic_id: uuid.UUID,
        *,
        subject_id: uuid.UUID | None,
        parent_topic_id: uuid.UUID | None,
        title_ru: str | None,
        title_kk: str | None,
        title_en: str | None,
        grade_level: int | None,
        difficulty_level: int | None,
        order_no: int | None,
    ) -> TopicModel:
        row = await self.get_topic(topic_id)
        if subject_id is not None:
            row.subject_id = subject_id
        if parent_topic_id is not None:
            row.parent_topic_id = parent_topic_id
        if title_ru is not None:
            row.title_ru = title_ru
        if title_kk is not None:
            row.title_kk = title_kk
        if title_en is not None:
            row.title_en = title_en
        if grade_level is not None:
            row.grade_level = grade_level
        if difficulty_level is not None:
            row.difficulty_level = difficulty_level
        if order_no is not None:
            row.order_no = order_no

        try:
            await self.session.flush()
        except IntegrityError:
            raise Conflict("Topic with these parameters already exists")
        return row

    async def delete_topic(self, topic_id: uuid.UUID) -> None:
        row = await self.get_topic(topic_id)
        await self.session.delete(row)
        await self.session.flush()

