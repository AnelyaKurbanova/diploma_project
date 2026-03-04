from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound
from app.core.i18n import tr
from app.modules.catalog.data.models import SubjectModel, TopicModel
from app.modules.lessons.data.models import LessonModel, LessonStatus


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
            raise Conflict(tr("subject_code_exists"))
        return row

    async def get_subject(self, subject_id: uuid.UUID) -> SubjectModel:
        row = await self.session.get(SubjectModel, subject_id)
        if not row:
            raise NotFound(tr("subject_not_found"))
        return row

    async def list_subjects(self) -> list[SubjectModel]:
        stmt: Select[SubjectModel] = select(SubjectModel).order_by(SubjectModel.code)
        rows: Sequence[SubjectModel] = (await self.session.execute(stmt)).scalars().all()
        return list(rows)

    async def list_subjects_with_topic_counts(self) -> list[tuple[SubjectModel, int]]:
        topic_count_subq = (
            select(
                TopicModel.subject_id,
                func.count().label("cnt"),
            )
            .where(TopicModel.parent_topic_id.is_(None))
            .group_by(TopicModel.subject_id)
            .subquery()
        )
        stmt = (
            select(SubjectModel, func.coalesce(topic_count_subq.c.cnt, 0))
            .outerjoin(topic_count_subq, SubjectModel.id == topic_count_subq.c.subject_id)
            .order_by(SubjectModel.code)
        )
        result = await self.session.execute(stmt)
        return [(row, cnt) for row, cnt in result.all()]

    async def get_subject_with_topic_count(self, subject_id: uuid.UUID) -> tuple[SubjectModel, int]:
        row = await self.get_subject(subject_id)
        cnt_stmt = (
            select(func.count())
            .select_from(TopicModel)
            .where(TopicModel.subject_id == subject_id, TopicModel.parent_topic_id.is_(None))
        )
        cnt_result = await self.session.execute(cnt_stmt)
        return row, cnt_result.scalar_one()

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
            raise Conflict(tr("subject_code_exists"))
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
        order_no: int,
    ) -> TopicModel:
        row = TopicModel(
            subject_id=subject_id,
            parent_topic_id=parent_topic_id,
            title_ru=title_ru,
            title_kk=title_kk,
            title_en=title_en,
            grade_level=grade_level,
            order_no=order_no,
        )
        self.session.add(row)
        try:
            await self.session.flush()
        except IntegrityError:
            raise Conflict(tr("topic_params_exist"))
        return row

    async def get_topic(self, topic_id: uuid.UUID) -> TopicModel:
        row = await self.session.get(TopicModel, topic_id)
        if not row:
            raise NotFound(tr("topic_not_found"))
        return row

    async def list_topics(
        self,
        *,
        subject_id: uuid.UUID | None = None,
        parent_topic_id: uuid.UUID | None = None,
        grade_level: int | None = None,
    ) -> list[TopicModel]:
        stmt: Select[TopicModel] = select(TopicModel).order_by(
            TopicModel.subject_id, TopicModel.order_no, TopicModel.created_at
        )
        if subject_id is not None:
            stmt = stmt.where(TopicModel.subject_id == subject_id)
        if parent_topic_id is not None:
            stmt = stmt.where(TopicModel.parent_topic_id == parent_topic_id)
        if grade_level is not None:
            stmt = stmt.where(TopicModel.grade_level == grade_level)

        rows: Sequence[TopicModel] = (await self.session.execute(stmt)).scalars().all()
        return list(rows)

    async def list_distinct_grades_for_subject(self, subject_code: str) -> list[int]:
        """Return sorted distinct grade levels for published lessons of a subject."""
        stmt = (
            select(LessonModel.grade_level)
            .join(TopicModel, LessonModel.topic_id == TopicModel.id)
            .join(SubjectModel, TopicModel.subject_id == SubjectModel.id)
            .where(
                SubjectModel.code == subject_code,
                LessonModel.status == LessonStatus.PUBLISHED,
                LessonModel.grade_level.is_not(None),
            )
            .distinct()
            .order_by(LessonModel.grade_level)
        )
        result = await self.session.execute(stmt)
        grades = [row[0] for row in result.all() if row[0] is not None]
        return grades

    async def list_topics_for_subject_and_grade(
        self,
        *,
        subject_code: str,
        grade_level: int,
    ) -> list[TopicModel]:
        """Return topics for subject+grade that have at least one published lesson."""
        lesson_subq = (
            select(LessonModel.topic_id)
            .join(TopicModel, LessonModel.topic_id == TopicModel.id)
            .join(SubjectModel, TopicModel.subject_id == SubjectModel.id)
            .where(
                SubjectModel.code == subject_code,
                LessonModel.status == LessonStatus.PUBLISHED,
                LessonModel.grade_level == grade_level,
            )
            .group_by(LessonModel.topic_id)
            .subquery()
        )

        stmt: Select[TopicModel] = (
            select(TopicModel)
            .where(TopicModel.id.in_(select(lesson_subq.c.topic_id)))
            .order_by(TopicModel.created_at)
        )
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
        if order_no is not None:
            row.order_no = order_no

        try:
            await self.session.flush()
        except IntegrityError:
            raise Conflict(tr("topic_params_exist"))
        return row

    async def delete_topic(self, topic_id: uuid.UUID) -> None:
        row = await self.get_topic(topic_id)
        await self.session.delete(row)
        await self.session.flush()

