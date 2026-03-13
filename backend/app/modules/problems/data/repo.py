from __future__ import annotations

import uuid
from typing import Iterable, Sequence

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import Conflict, NotFound
from app.core.i18n import tr
from app.modules.problems.data.models import (
    ProblemAnswerKeyModel,
    ProblemChoiceModel,
    ProblemDifficulty,
    ProblemImageModel,
    ProblemModel,
    ProblemStatus,
    ProblemTagMapModel,
    ProblemTagModel,
    ProblemType,
)


class ProblemsRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _get_problem_or_404(self, problem_id: uuid.UUID) -> ProblemModel:
        stmt = (
            select(ProblemModel)
            .where(ProblemModel.id == problem_id)
            .options(
                selectinload(ProblemModel.choices),
                selectinload(ProblemModel.answer_keys),
                selectinload(ProblemModel.tags).selectinload(ProblemTagMapModel.tag),
                selectinload(ProblemModel.images),
            )
        )
        row = (await self.session.execute(stmt)).scalar_one_or_none()
        if not row:
            raise NotFound(tr("problem_not_found"))
        return row

    async def create_problem(
        self,
        *,
        subject_id: uuid.UUID,
        topic_id: uuid.UUID | None,
        type: ProblemType,
        difficulty: ProblemDifficulty,
        title: str,
        statement: str,
        statement_normalized: str,
        explanation: str | None,
        time_limit_sec: int,
        points: int,
        created_by: uuid.UUID | None,
    ) -> ProblemModel:
        row = ProblemModel(
            subject_id=subject_id,
            topic_id=topic_id,
            type=type,
            difficulty=difficulty,
            title=title,
            statement=statement,
            statement_normalized=statement_normalized,
            explanation=explanation,
            time_limit_sec=time_limit_sec,
            points=points,
            created_by=created_by,
        )
        self.session.add(row)
        try:
            await self.session.flush()
        except IntegrityError as exc:
            raise Conflict(tr("failed_to_create_problem")) from exc
        return row

    async def set_choices(
        self,
        problem: ProblemModel,
        choices: Iterable[tuple[str, bool, int]],
    ) -> None:
        await self.session.refresh(problem, ["choices"])
        problem.choices.clear()
        for text, is_correct, order_no in choices:
            problem.choices.append(
                ProblemChoiceModel(
                    choice_text=text,
                    is_correct=is_correct,
                    order_no=order_no,
                )
            )
        await self.session.flush()

    async def set_answer_keys(
        self,
        problem: ProblemModel,
        *,
        numeric_answer: float | None,
        text_answer: str | None,
        answer_pattern: str | None,
        tolerance: float | None,
        canonical_answer: str | None = None,
    ) -> None:
        await self.session.refresh(problem, ["answer_keys"])

        if (
            numeric_answer is None
            and text_answer is None
            and answer_pattern is None
        ):
            if problem.answer_keys is not None:
                await self.session.delete(problem.answer_keys)
            return

        if problem.answer_keys is None:
            problem.answer_keys = ProblemAnswerKeyModel()

        problem.answer_keys.numeric_answer = numeric_answer
        problem.answer_keys.text_answer = text_answer
        problem.answer_keys.answer_pattern = answer_pattern
        problem.answer_keys.tolerance = tolerance
        problem.answer_keys.canonical_answer = canonical_answer

        await self.session.flush()

    async def set_images(
        self,
        problem: ProblemModel,
        images: Iterable[tuple[str, int, str | None]],
    ) -> None:
        await self.session.refresh(problem, ["images"])
        problem.images.clear()
        await self.session.flush()
        for url, order_no, alt_text in images:
            problem.images.append(
                ProblemImageModel(
                    url=url,
                    order_no=order_no,
                    alt_text=alt_text,
                )
            )
        await self.session.flush()

    async def set_tags(
        self,
        problem: ProblemModel,
        tag_names: Iterable[str],
    ) -> None:
        await self.session.refresh(problem, ["tags"])
        normalized = {name.strip().lower() for name in tag_names if name.strip()}
        if not normalized:
            problem.tags.clear()
            await self.session.flush()
            return

        existing_stmt: Select[ProblemTagModel] = select(ProblemTagModel).where(
            ProblemTagModel.name.in_(normalized)
        )
        existing_rows: Sequence[ProblemTagModel] = (
            await self.session.execute(existing_stmt)
        ).scalars().all()
        by_name = {row.name: row for row in existing_rows}

        tags: list[ProblemTagModel] = []
        for name in normalized:
            tag = by_name.get(name)
            if not tag:
                tag = ProblemTagModel(name=name)
                self.session.add(tag)
                await self.session.flush()
            tags.append(tag)

        problem.tags.clear()
        for tag in tags:
            problem.tags.append(
                ProblemTagMapModel(
                    tag=tag,
                )
            )
        await self.session.flush()

    async def get_problem(self, problem_id: uuid.UUID) -> ProblemModel:
        return await self._get_problem_or_404(problem_id)

    async def list_problems(
        self,
        *,
        subject_id: uuid.UUID | None = None,
        topic_id: uuid.UUID | None = None,
        difficulty: ProblemDifficulty | None = None,
        status: ProblemStatus | None = None,
    ) -> list[ProblemModel]:
        stmt: Select[ProblemModel] = (
            select(ProblemModel)
            .options(
                selectinload(ProblemModel.choices),
                selectinload(ProblemModel.answer_keys),
                selectinload(ProblemModel.tags).selectinload(ProblemTagMapModel.tag),
                selectinload(ProblemModel.images),
            )
            .order_by(ProblemModel.created_at.desc())
        )
        if subject_id is not None:
            stmt = stmt.where(ProblemModel.subject_id == subject_id)
        if topic_id is not None:
            stmt = stmt.where(ProblemModel.topic_id == topic_id)
        if difficulty is not None:
            stmt = stmt.where(ProblemModel.difficulty == difficulty)
        if status is not None:
            stmt = stmt.where(ProblemModel.status == status)

        rows: Sequence[ProblemModel] = (await self.session.execute(stmt)).scalars().all()
        return list(rows)

    async def list_problems_paginated(
        self,
        *,
        status: ProblemStatus | None = None,
        subject_id: uuid.UUID | None = None,
        topic_id: uuid.UUID | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[ProblemModel], int]:
        stmt: Select[ProblemModel] = (
            select(ProblemModel)
            .options(
                selectinload(ProblemModel.choices),
                selectinload(ProblemModel.answer_keys),
                selectinload(ProblemModel.tags).selectinload(ProblemTagMapModel.tag),
                selectinload(ProblemModel.images),
            )
            .order_by(ProblemModel.created_at.desc())
        )
        count_stmt = select(func.count()).select_from(ProblemModel)

        if status is not None:
            stmt = stmt.where(ProblemModel.status == status)
            count_stmt = count_stmt.where(ProblemModel.status == status)
        if subject_id is not None:
            stmt = stmt.where(ProblemModel.subject_id == subject_id)
            count_stmt = count_stmt.where(ProblemModel.subject_id == subject_id)
        if topic_id is not None:
            stmt = stmt.where(ProblemModel.topic_id == topic_id)
            count_stmt = count_stmt.where(ProblemModel.topic_id == topic_id)

        total = (await self.session.execute(count_stmt)).scalar_one()
        rows: Sequence[ProblemModel] = (
            await self.session.execute(stmt.offset(offset).limit(limit))
        ).scalars().all()
        return list(rows), total

    async def update_problem(
        self,
        problem_id: uuid.UUID,
        *,
        subject_id: uuid.UUID | None,
        topic_id: uuid.UUID | None,
        difficulty: ProblemDifficulty | None,
        title: str | None,
        statement: str | None,
        statement_normalized: str | None,
        explanation: str | None,
        time_limit_sec: int | None,
        points: int | None,
    ) -> ProblemModel:
        row = await self._get_problem_or_404(problem_id)
        if subject_id is not None:
            row.subject_id = subject_id
        if topic_id is not None:
            row.topic_id = topic_id
        if difficulty is not None:
            row.difficulty = difficulty
        if title is not None:
            row.title = title
        if statement is not None:
            row.statement = statement
        if statement_normalized is not None:
            row.statement_normalized = statement_normalized
        if explanation is not None:
            row.explanation = explanation
        if time_limit_sec is not None:
            row.time_limit_sec = time_limit_sec
        if points is not None:
            row.points = points

        try:
            await self.session.flush()
        except IntegrityError as exc:
            raise Conflict(tr("failed_to_update_problem")) from exc
        return row

    async def list_normalized_statements_for_topic(
        self,
        *,
        topic_id: uuid.UUID,
    ) -> set[str]:
        """Return a set of normalized statements for a given topic."""
        stmt: Select[str] = select(ProblemModel.statement_normalized).where(
            ProblemModel.topic_id == topic_id
        )
        rows: Sequence[str] = (await self.session.execute(stmt)).scalars().all()
        return set(rows)

    async def change_status(
        self,
        problem_id: uuid.UUID,
        *,
        status: ProblemStatus,
    ) -> ProblemModel:
        row = await self._get_problem_or_404(problem_id)
        row.status = status
        await self.session.flush()
        return row

    async def delete_problem(self, problem_id: uuid.UUID) -> None:
        row = await self._get_problem_or_404(problem_id)
        await self.session.delete(row)
        try:
            await self.session.flush()
        except IntegrityError:
            await self.session.rollback()
            raise Conflict(tr("problem_has_submissions_cannot_delete"))
