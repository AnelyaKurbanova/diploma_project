from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.problems.api.schemas import ProblemCreate, ProblemUpdate
from app.modules.problems.application.canonicalize import normalize_for_storage
from app.modules.problems.data.models import (
    ProblemDifficulty,
    ProblemModel,
    ProblemStatus,
)
from app.modules.problems.data.repo import ProblemsRepo
from app.core.i18n import tr


def _compute_canonical(answer_key_data) -> str | None:  # noqa: ANN001
    if answer_key_data is None:
        return None
    raw = answer_key_data.text_answer
    if raw:
        return normalize_for_storage(raw)
    if answer_key_data.numeric_answer is not None:
        return normalize_for_storage(str(answer_key_data.numeric_answer))
    return None


class ProblemService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ProblemsRepo(session)

    async def _commit_and_reload(self, problem_id: uuid.UUID) -> ProblemModel:
        await self.session.commit()
        return await self.repo.get_problem(problem_id)

    async def _save_answer_keys(self, problem: ProblemModel, answer_key_data) -> None:  # noqa: ANN001
        if answer_key_data is None:
            return
        canonical = _compute_canonical(answer_key_data)
        await self.repo.set_answer_keys(
            problem,
            numeric_answer=(
                float(answer_key_data.numeric_answer)
                if answer_key_data.numeric_answer is not None
                else None
            ),
            text_answer=answer_key_data.text_answer,
            answer_pattern=answer_key_data.answer_pattern,
            tolerance=(
                float(answer_key_data.tolerance)
                if answer_key_data.tolerance is not None
                else None
            ),
            canonical_answer=canonical,
        )

    async def _save_images(self, problem: ProblemModel, images_data) -> None:  # noqa: ANN001
        if images_data is None:
            return
        await self.repo.set_images(
            problem,
            [(img.url, img.order_no, img.alt_text) for img in images_data],
        )

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

        await self._save_answer_keys(problem, data.answer_key)

        if data.tags is not None:
            await self.repo.set_tags(
                problem,
                [t.name for t in data.tags],
            )

        await self._save_images(problem, data.images)

        return await self._commit_and_reload(problem.id)

    async def get(self, problem_id: uuid.UUID) -> ProblemModel:
        return await self.repo.get_problem(problem_id)

    async def get_public(self, problem_id: uuid.UUID) -> ProblemModel:
        problem = await self.repo.get_problem(problem_id)
        if problem.status != ProblemStatus.PUBLISHED:
            from app.core.errors import NotFound

            raise NotFound(tr("problem_not_found"))
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

            raise Conflict(tr("only_draft_or_pending_edit"))

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

        await self._save_answer_keys(problem, data.answer_key)

        if data.tags is not None:
            await self.repo.set_tags(
                problem,
                [t.name for t in data.tags],
            )

        await self._save_images(problem, data.images)

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
            raise Conflict(tr("only_draft_submit_review"))
        await self.repo.change_status(
            problem_id,
            status=ProblemStatus.PENDING_REVIEW,
        )
        return await self._commit_and_reload(problem_id)

    async def moderator_publish(self, problem_id: uuid.UUID) -> ProblemModel:
        problem = await self.repo.get_problem(problem_id)
        if problem.status != ProblemStatus.PENDING_REVIEW:
            from app.core.errors import Conflict
            raise Conflict(tr("only_pending_publish"))
        await self.repo.change_status(
            problem_id,
            status=ProblemStatus.PUBLISHED,
        )
        return await self._commit_and_reload(problem_id)

    async def reject_problem(self, problem_id: uuid.UUID) -> ProblemModel:
        problem = await self.repo.get_problem(problem_id)
        if problem.status != ProblemStatus.PENDING_REVIEW:
            from app.core.errors import Conflict
            raise Conflict(tr("only_pending_reject"))
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
