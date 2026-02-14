from __future__ import annotations

import math
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.modules.problems.data.models import (
    ProblemChoiceModel,
    ProblemModel,
    ProblemStatus,
    ProblemType,
)
from app.modules.problems.data.repo import ProblemsRepo
from app.modules.submissions.api.schemas import SubmissionAnswer, SubmissionCreate, SubmissionResultOut
from app.modules.submissions.data.models import SubmissionModel, SubmissionStatus
from app.modules.submissions.data.repo import SubmissionsRepo


class SubmissionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.problems_repo = ProblemsRepo(session)
        self.submissions_repo = SubmissionsRepo(session)

    @asynccontextmanager
    async def _tx(self):
        """
        Safe transaction helper.

        FastAPI dependencies can start a transaction earlier on the same session
        (e.g. while resolving current user). In that case `session.begin()` would
        raise `InvalidRequestError`, so we commit/rollback explicitly.
        """
        if self.session.in_transaction():
            try:
                yield
                await self.session.commit()
            except Exception:
                await self.session.rollback()
                raise
        else:
            async with self.session.begin():
                yield

    async def _grade_single_multiple_choice(
        self,
        problem: ProblemModel,
        choice_ids: list[uuid.UUID] | None,
    ) -> tuple[bool | None, int | None]:
        if choice_ids is None:
            return None, None

        # Load correct choices for this problem
        correct_ids = {c.id for c in problem.choices if c.is_correct}
        selected_ids = set(choice_ids)

        if not correct_ids:
            # No key defined – cannot grade deterministically
            return None, None

        if problem.type is ProblemType.SINGLE_CHOICE:
            is_correct = len(selected_ids) == 1 and selected_ids == correct_ids
        elif problem.type is ProblemType.MULTIPLE_CHOICE:
            is_correct = selected_ids == correct_ids
        else:
            return None, None

        return is_correct, problem.points if is_correct else 0

    def _grade_numeric(
        self,
        correct_value: float | None,
        tolerance: float | None,
        answer_numeric: Decimal | None,
        points: int,
    ) -> tuple[bool | None, int | None]:
        if correct_value is None or answer_numeric is None:
            return None, None

        tol = tolerance or 0.0
        diff = abs(float(answer_numeric) - float(correct_value))
        is_correct = diff <= tol
        return is_correct, points if is_correct else 0

    def _grade_short_text(
        self,
        text_answer: str | None,
        answer_pattern: str | None,
        user_answer: str | None,
        points: int,
    ) -> tuple[bool | None, int | None]:
        if user_answer is None:
            return None, None

        ua = user_answer.strip()
        if not ua:
            return None, None

        if answer_pattern:
            try:
                pattern = re.compile(answer_pattern, flags=re.IGNORECASE)
            except re.error:
                # Broken pattern – fallback to simple comparison
                pattern = None
            if pattern is not None:
                is_correct = pattern.fullmatch(ua) is not None
                return is_correct, points if is_correct else 0

        if text_answer is None:
            return None, None

        is_correct = ua.lower() == text_answer.strip().lower()
        return is_correct, points if is_correct else 0

    async def submit(self, user_id: uuid.UUID, data: SubmissionCreate) -> SubmissionResultOut:
        problem = await self.problems_repo.get_problem(data.problem_id)
        if problem.status != ProblemStatus.PUBLISHED:
            raise NotFound("Problem not available")

        answer: SubmissionAnswer = data.answer
        is_correct: bool | None = None
        score: int | None = None

        if problem.type in (ProblemType.SINGLE_CHOICE, ProblemType.MULTIPLE_CHOICE):
            is_correct, score = await self._grade_single_multiple_choice(
                problem,
                answer.choice_ids or [],
            )
        elif problem.type is ProblemType.NUMERIC:
            ak = problem.answer_keys
            if ak is not None:
                is_correct, score = self._grade_numeric(
                    correct_value=ak.numeric_answer,
                    tolerance=ak.tolerance,
                    answer_numeric=answer.answer_numeric,
                    points=problem.points,
                )
        elif problem.type is ProblemType.SHORT_TEXT:
            ak = problem.answer_keys
            if ak is not None:
                is_correct, score = self._grade_short_text(
                    text_answer=ak.text_answer,
                    answer_pattern=ak.answer_pattern,
                    user_answer=answer.answer_text,
                    points=problem.points,
                )
        else:
            # MATCH and other types can be added later
            is_correct, score = None, None

        status = (
            SubmissionStatus.GRADED
            if is_correct is not None
            else SubmissionStatus.NEEDS_REVIEW
        )

        async with self._tx():
            attempt_no = await self.submissions_repo.next_attempt_no(
                user_id,
                data.problem_id,
            )
            submission: SubmissionModel = await self.submissions_repo.create_submission(
                user_id=user_id,
                problem_id=data.problem_id,
                attempt_no=attempt_no,
                status=status,
                is_correct=is_correct,
                score=score,
                answer_text=answer.answer_text,
                answer_numeric=float(answer.answer_numeric)
                if answer.answer_numeric is not None
                else None,
            )

            if answer.choice_ids:
                await self.submissions_repo.set_submission_choices(
                    submission,
                    answer.choice_ids,
                )

        created_at = submission.submitted_at or datetime.now(timezone.utc)
        message = "Graded" if status is SubmissionStatus.GRADED else "Sent to review"

        return SubmissionResultOut(
            submission_id=submission.id,
            problem_id=submission.problem_id,
            status=status,
            is_correct=is_correct,
            score=score,
            created_at=created_at,
            message=message,
        )
