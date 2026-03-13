from __future__ import annotations

import uuid
from typing import Iterable, Sequence

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.submissions.data.models import (
    SubmissionChoiceMapModel,
    SubmissionModel,
    SubmissionStatus,
)


class SubmissionsRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def next_attempt_no(
        self,
        user_id: uuid.UUID,
        problem_id: uuid.UUID,
        assessment_id: uuid.UUID | None = None,
    ) -> int:
        stmt: Select[SubmissionModel] = select(SubmissionModel.attempt_no).where(
            SubmissionModel.user_id == user_id,
            SubmissionModel.problem_id == problem_id,
            SubmissionModel.assessment_id == assessment_id,
        )
        rows: Sequence[int] = (await self.session.execute(stmt)).scalars().all()
        return (max(rows) + 1) if rows else 1

    async def create_submission(
        self,
        *,
        user_id: uuid.UUID,
        problem_id: uuid.UUID,
        assessment_id: uuid.UUID | None,
        attempt_no: int,
        status: SubmissionStatus,
        is_correct: bool | None,
        score: int | None,
        answer_text: str | None,
        answer_numeric: float | None,
        grading_trace: dict | None,
    ) -> SubmissionModel:
        submission = SubmissionModel(
            user_id=user_id,
            problem_id=problem_id,
            assessment_id=assessment_id,
            attempt_no=attempt_no,
            status=status.value,
            is_correct=is_correct,
            score=score,
            answer_text=answer_text,
            answer_numeric=answer_numeric,
            grading_trace=grading_trace,
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

    async def get_last_for_user_problem(
        self,
        user_id: uuid.UUID,
        problem_id: uuid.UUID,
        assessment_id: uuid.UUID | None = None,
    ) -> SubmissionModel | None:
        stmt: Select[SubmissionModel] = (
            select(SubmissionModel)
            .where(
                SubmissionModel.user_id == user_id,
                SubmissionModel.problem_id == problem_id,
                SubmissionModel.assessment_id == assessment_id,
            )
            .order_by(SubmissionModel.submitted_at.desc())
            .limit(1)
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def get_choice_ids_for_submission(
        self,
        submission_id: uuid.UUID,
    ) -> list[uuid.UUID]:
        stmt: Select[SubmissionChoiceMapModel] = select(
            SubmissionChoiceMapModel.choice_id
        ).where(SubmissionChoiceMapModel.submission_id == submission_id)
        rows: Sequence[uuid.UUID] = (await self.session.execute(stmt)).scalars().all()
        return list(rows)

    async def get_last_for_user_problems(
        self,
        user_id: uuid.UUID,
        problem_ids: Sequence[uuid.UUID],
        assessment_id: uuid.UUID | None = None,
    ) -> list[SubmissionModel]:
        if not problem_ids:
            return []
        stmt: Select[SubmissionModel] = (
            select(SubmissionModel)
            .where(
                SubmissionModel.user_id == user_id,
                SubmissionModel.problem_id.in_(problem_ids),
                SubmissionModel.assessment_id == assessment_id,
            )
            .order_by(SubmissionModel.submitted_at.desc())
        )
        rows: Sequence[SubmissionModel] = (await self.session.execute(stmt)).scalars().all()
        seen: set[uuid.UUID] = set()
        result: list[SubmissionModel] = []
        for sub in rows:
            if sub.problem_id not in seen:
                seen.add(sub.problem_id)
                result.append(sub)
        return result

    async def get_choice_ids_for_submissions(
        self,
        submission_ids: Sequence[uuid.UUID],
    ) -> dict[uuid.UUID, list[uuid.UUID]]:
        if not submission_ids:
            return {}
        stmt: Select[SubmissionChoiceMapModel] = select(
            SubmissionChoiceMapModel.submission_id,
            SubmissionChoiceMapModel.choice_id,
        ).where(SubmissionChoiceMapModel.submission_id.in_(submission_ids))
        rows = (await self.session.execute(stmt)).all()
        out: dict[uuid.UUID, list[uuid.UUID]] = {sid: [] for sid in submission_ids}
        for submission_id, choice_id in rows:
            out[submission_id].append(choice_id)
        return out
