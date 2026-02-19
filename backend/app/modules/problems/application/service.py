from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.problems.api.schemas import ProblemCreate, ProblemUpdate
from app.modules.problems.data.models import (
    ProblemDifficulty,
    ProblemModel,
    ProblemStatus,
)
from app.modules.problems.data.repo import ProblemsRepo


class ProblemService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ProblemsRepo(session)

    async def _commit_and_reload(self, problem_id: uuid.UUID) -> ProblemModel:
        """Commit current transaction and re-fetch the problem with all relations."""
        await self.session.commit()
        return await self.repo.get_problem(problem_id)

    async def create_draft_problem(
        self,
        data: ProblemCreate,
        *,
        created_by: uuid.UUID | None = None,
    ) -> ProblemModel:
        problem = await self.repo.create_problem(
            subject_id=data.subject_id,
            topic_id=data.topic_id,
            type=data.type,
            difficulty=data.difficulty,
            title=data.title,
            statement=data.statement,
            explanation=data.explanation,
            time_limit_sec=data.time_limit_sec,
            points=data.points,
            created_by=created_by,
        )

        if data.choices is not None:
            await self.repo.set_choices(
                problem,
                [
                    (c.choice_text, c.is_correct, c.order_no)
                    for c in data.choices
                ],
            )
        if data.answer_key is not None:
            await self.repo.set_answer_keys(
                problem,
                numeric_answer=(
                    float(data.answer_key.numeric_answer)
                    if data.answer_key.numeric_answer is not None
                    else None
                ),
                text_answer=data.answer_key.text_answer,
                answer_pattern=data.answer_key.answer_pattern,
                tolerance=(
                    float(data.answer_key.tolerance)
                    if data.answer_key.tolerance is not None
                    else None
                ),
            )
        if data.tags is not None:
            await self.repo.set_tags(
                problem,
                [t.name for t in data.tags],
            )

        return await self._commit_and_reload(problem.id)

    async def get(self, problem_id: uuid.UUID) -> ProblemModel:
        return await self.repo.get_problem(problem_id)

    async def get_public(self, problem_id: uuid.UUID) -> ProblemModel:
        problem = await self.repo.get_problem(problem_id)
        if problem.status != ProblemStatus.PUBLISHED:
            from app.core.errors import NotFound

            raise NotFound("Problem not found")
        return problem

    async def list_public(
        self,
        *,
        subject_id: uuid.UUID | None = None,
        topic_id: uuid.UUID | None = None,
        difficulty: ProblemDifficulty | None = None,
    ) -> list[ProblemModel]:
        return await self.repo.list_problems(
            subject_id=subject_id,
            topic_id=topic_id,
            difficulty=difficulty,
            status=ProblemStatus.PUBLISHED,
        )

    async def update_draft(
        self,
        problem_id: uuid.UUID,
        data: ProblemUpdate,
    ) -> ProblemModel:
        problem = await self.repo.get_problem(problem_id)
        if problem.status not in (ProblemStatus.DRAFT, ProblemStatus.PENDING_REVIEW):
            from app.core.errors import Conflict

            raise Conflict("Only draft or pending-review problems can be edited")

        # If editing a pending_review problem, reset it back to draft
        if problem.status == ProblemStatus.PENDING_REVIEW:
            await self.repo.change_status(problem_id, status=ProblemStatus.DRAFT)

        problem = await self.repo.update_problem(
            problem_id,
            subject_id=data.subject_id,
            topic_id=data.topic_id,
            difficulty=data.difficulty,
            title=data.title,
            statement=data.statement,
            explanation=data.explanation,
            time_limit_sec=data.time_limit_sec,
            points=data.points,
        )

        if data.choices is not None:
            await self.repo.set_choices(
                problem,
                [
                    (c.choice_text, c.is_correct, c.order_no)
                    for c in data.choices
                ],
            )
        if data.answer_key is not None:
            await self.repo.set_answer_keys(
                problem,
                numeric_answer=(
                    float(data.answer_key.numeric_answer)
                    if data.answer_key.numeric_answer is not None
                    else None
                ),
                text_answer=data.answer_key.text_answer,
                answer_pattern=data.answer_key.answer_pattern,
                tolerance=(
                    float(data.answer_key.tolerance)
                    if data.answer_key.tolerance is not None
                    else None
                ),
            )
        if data.tags is not None:
            await self.repo.set_tags(
                problem,
                [t.name for t in data.tags],
            )

        return await self._commit_and_reload(problem_id)

    async def list_all(
        self,
        *,
        status: ProblemStatus | None = None,
        subject_id: uuid.UUID | None = None,
        topic_id: uuid.UUID | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[ProblemModel], int]:
        return await self.repo.list_problems_paginated(
            status=status,
            subject_id=subject_id,
            topic_id=topic_id,
            offset=offset,
            limit=limit,
        )

    async def submit_for_review(self, problem_id: uuid.UUID) -> ProblemModel:
        problem = await self.repo.get_problem(problem_id)
        if problem.status != ProblemStatus.DRAFT:
            from app.core.errors import Conflict
            raise Conflict("Only draft problems can be submitted for review")
        await self.repo.change_status(
            problem_id,
            status=ProblemStatus.PENDING_REVIEW,
        )
        return await self._commit_and_reload(problem_id)

    async def moderator_publish(self, problem_id: uuid.UUID) -> ProblemModel:
        problem = await self.repo.get_problem(problem_id)
        if problem.status != ProblemStatus.PENDING_REVIEW:
            from app.core.errors import Conflict
            raise Conflict("Only problems pending review can be published")
        await self.repo.change_status(
            problem_id,
            status=ProblemStatus.PUBLISHED,
        )
        return await self._commit_and_reload(problem_id)

    async def reject_problem(self, problem_id: uuid.UUID) -> ProblemModel:
        problem = await self.repo.get_problem(problem_id)
        if problem.status != ProblemStatus.PENDING_REVIEW:
            from app.core.errors import Conflict
            raise Conflict("Only problems pending review can be rejected")
        await self.repo.change_status(
            problem_id,
            status=ProblemStatus.DRAFT,
        )
        return await self._commit_and_reload(problem_id)

    async def archive_problem(self, problem_id: uuid.UUID) -> ProblemModel:
        await self.repo.change_status(
            problem_id,
            status=ProblemStatus.ARCHIVED,
        )
        return await self._commit_and_reload(problem_id)

    async def delete_problem(self, problem_id: uuid.UUID) -> None:
        await self.repo.delete_problem(problem_id)
        await self.session.commit()
