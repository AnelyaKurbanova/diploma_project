from __future__ import annotations

import uuid
from typing import Iterable, Sequence

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.submissions.data.models import SubmissionChoiceMapModel, SubmissionModel, SubmissionStatus


class SubmissionsRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def next_attempt_no(self, user_id: uuid.UUID | None, problem_id: uuid.UUID) -> int:
        if user_id is None:
            return 1
        stmt: Select[SubmissionModel] = select(SubmissionModel.attempt_no).where(
            SubmissionModel.user_id == user_id,
            SubmissionModel.problem_id == problem_id,
        )
        rows: Sequence[int] = (await self.session.execute(stmt)).scalars().all()
        return (max(rows) + 1) if rows else 1

    async def create_submission(
        self,
        *,
        user_id: uuid.UUID | None,
        problem_id: uuid.UUID,
        attempt_no: int,
        status: SubmissionStatus,
        is_correct: bool | None,
        score: int | None,
        answer_text: str | None,
        answer_numeric: float | None,
    ) -> SubmissionModel:
        submission = SubmissionModel(
            user_id=user_id,
            problem_id=problem_id,
            attempt_no=attempt_no,
            status=status.value,
            is_correct=is_correct,
            score=score,
            answer_text=answer_text,
            answer_numeric=answer_numeric,
        )
        self.session.add(submission)
        await self.session.flush()
        return submission

    async def set_submission_choices(
        self,
        submission: SubmissionModel,
        choice_ids: Iterable[uuid.UUID],
    ) -> None:
        for choice_id in choice_ids:
            self.session.add(
                SubmissionChoiceMapModel(
                    submission_id=submission.id,
                    choice_id=choice_id,
                )
            )
        await self.session.flush()

