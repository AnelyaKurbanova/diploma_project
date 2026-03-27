from __future__ import annotations

import logging
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.core.errors import Forbidden, BadRequest
from app.core.i18n import tr
from app.modules.classes.data.repo import ClassRepo
from app.modules.problems.application.canonicalize import normalize_for_storage
from app.modules.problems.data.models import (
    ProblemAnswerKeyModel,
    ProblemModel,
    ProblemStatus,
    ProblemType,
)
from app.modules.problems.data.repo import ProblemsRepo
from app.modules.submissions.api.schemas import (
    SubmissionAnswer,
    SubmissionCreate,
    SubmissionResultOut,
    SubmissionProgressOut,
    SubmissionProgressItemOut,
)
from app.modules.submissions.data.models import SubmissionModel, SubmissionStatus
from app.modules.submissions.data.repo import SubmissionsRepo

logger = logging.getLogger(__name__)

_FRACTION_RE = re.compile(r"^([+-]?\d+(?:[.,]\d+)?)\s*/\s*(\d+(?:[.,]\d+)?)$")
_NUMBER_PREFIX_RE = re.compile(r"^([+-]?\d+(?:[.,]\d+)?)")


def _try_parse_number(s: str) -> float | None:
    s = s.strip()
    if not s:
        return None
    s = unicodedata.normalize("NFKC", s)
    s = s.replace(",", ".").replace(" ", "").replace("\u00a0", "")
    s = s.replace("\u2212", "-")
    try:
        return float(s)
    except ValueError:
        pass
    m = _FRACTION_RE.match(s)
    if m:
        num = float(m.group(1).replace(",", "."))
        den = float(m.group(2).replace(",", "."))
        if den != 0:
            return num / den

    m = _NUMBER_PREFIX_RE.match(s)
    if m:
        try:
            return float(m.group(1).replace(",", "."))
        except ValueError:
            return None
    return None


class SubmissionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.problems_repo = ProblemsRepo(session)
        self.submissions_repo = SubmissionsRepo(session)

    @asynccontextmanager
    async def _tx(self):
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

        correct_ids = {c.id for c in problem.choices if c.is_correct}
        selected_ids = set(choice_ids)

        if not correct_ids:
            return None, None

        if problem.type is ProblemType.SINGLE_CHOICE:
            is_correct = len(selected_ids) == 1 and selected_ids == correct_ids
        elif problem.type is ProblemType.MULTIPLE_CHOICE:
            is_correct = selected_ids == correct_ids
        else:
            return None, None

        return is_correct, problem.points if is_correct else 0

    def _deterministic_text_check(
        self,
        user_answer: str,
        answer_key: ProblemAnswerKeyModel,
        points: int,
    ) -> tuple[bool | None, int | None, dict]:
        ua = user_answer.strip()
        if not ua:
            return None, None, {"kind": "empty"}

        ua_norm = unicodedata.normalize("NFKC", ua)

        if answer_key.answer_pattern:
            try:
                pattern = re.compile(answer_key.answer_pattern, flags=re.IGNORECASE)
                is_correct = pattern.fullmatch(ua_norm) is not None
                return (
                    is_correct,
                    points if is_correct else 0,
                    {
                        "kind": "pattern_fullmatch",
                        "pattern": answer_key.answer_pattern,
                    },
                )
            except re.error:
                pass

        if answer_key.text_answer is not None:
            if ua_norm.lower() == answer_key.text_answer.strip().lower():
                return True, points, {"kind": "text_equal"}

        if answer_key.canonical_answer:
            user_canonical = normalize_for_storage(ua_norm)
            if user_canonical:
                stored = answer_key.canonical_answer
                # Сравниваем канонические ответы без учёта пробелов,
                # чтобы не наказывать за разные форматирования формул.
                if (
                    user_canonical == stored
                    or user_canonical.replace(" ", "")
                    == stored.replace(" ", "")
                ):
                    return (
                        True,
                        points,
                        {
                            "kind": "canonical_match",
                            "user_canonical": user_canonical,
                            "stored_canonical": stored,
                        },
                    )

        if answer_key.numeric_answer is not None:
            parsed = _try_parse_number(ua_norm)
            if parsed is not None:
                tol = float(answer_key.tolerance or 0)
                diff = abs(parsed - float(answer_key.numeric_answer))
                is_correct = diff <= tol
                return (
                    is_correct,
                    points if is_correct else 0,
                    {
                        "kind": "numeric_with_tolerance",
                        "parsed": parsed,
                        "target": float(answer_key.numeric_answer),
                        "tolerance": tol,
                        "diff": diff,
                    },
                )
            return None, None, {"kind": "numeric_parse_failed"}

        if answer_key.text_answer is not None:
            return False, 0, {"kind": "text_mismatch"}

        return None, None, {"kind": "no_answer_key"}

    async def submit(self, user_id: uuid.UUID, data: SubmissionCreate) -> SubmissionResultOut:
        problem = await self.problems_repo.get_problem(data.problem_id)
        if problem.status != ProblemStatus.PUBLISHED:
            raise NotFound(tr("problem_not_available"))

        if data.assessment_id is not None:
            class_repo = ClassRepo(self.session)
            assessment = await class_repo.get_assessment_by_id(data.assessment_id)
            if assessment is None or not assessment.is_published:
                raise NotFound("Контрольная не найдена")
            if assessment.due_at is not None and datetime.now(timezone.utc) > assessment.due_at:
                raise BadRequest("Дедлайн контрольной истек")
            student_classes = await class_repo.list_for_student(user_id)
            if not any(c.id == assessment.class_id for c in student_classes):
                raise Forbidden("Контрольная недоступна")
            assessment_items = await class_repo.list_assessment_items(assessment.id)
            if not any(item.problem_id == data.problem_id for item in assessment_items):
                raise BadRequest("Задача не входит в эту контрольную")

        answer: SubmissionAnswer = data.answer
        is_correct: bool | None = None
        score: int | None = None
        grading_trace: dict | None = {
            "problem_type": problem.type.value,
            "input": {
                "answer_text": answer.answer_text,
                "answer_numeric": float(answer.answer_numeric)
                if answer.answer_numeric is not None
                else None,
                "choice_ids": [str(cid) for cid in (answer.choice_ids or [])],
            },
        }

        if problem.type in (ProblemType.SINGLE_CHOICE, ProblemType.MULTIPLE_CHOICE):
            is_correct, score = await self._grade_single_multiple_choice(
                problem,
                answer.choice_ids or [],
            )
            if grading_trace is not None:
                grading_trace["choice_grading"] = {
                    "is_correct": is_correct,
                    "score": score,
                }
        elif problem.type in (ProblemType.NUMERIC, ProblemType.SHORT_TEXT):
            ak = problem.answer_keys
            user_text = answer.answer_text
            if user_text is None and answer.answer_numeric is not None:
                user_text = str(answer.answer_numeric)

            if ak is not None and user_text:
                # Stage 1: deterministic check on raw input
                is_correct, score, debug1 = self._deterministic_text_check(
                    user_text,
                    ak,
                    problem.points,
                )
                if grading_trace is not None:
                    grading_trace["deterministic_first"] = {
                        "is_correct": is_correct,
                        "score": score,
                        "debug": debug1,
                    }
                llm_info: dict | None = None
                if is_correct is not True:
                    try:
                        from app.modules.submissions.application.llm_normalizer import (
                            normalize_answer_via_llm,
                        )

                        normalized = await normalize_answer_via_llm(user_text)
                        llm_info = {
                            "called": True,
                            "normalized": normalized,
                        }
                        if (
                            normalized
                            and normalized.strip().lower() != user_text.strip().lower()
                        ):
                            llm_correct, llm_score, debug2 = (
                                self._deterministic_text_check(
                                    normalized,
                                    ak,
                                    problem.points,
                                )
                            )
                            if grading_trace is not None:
                                grading_trace["deterministic_second"] = {
                                    "normalized_input": normalized,
                                    "is_correct": llm_correct,
                                    "score": llm_score,
                                    "debug": debug2,
                                }
                            if llm_correct is True:
                                is_correct, score = True, llm_score
                    except Exception as exc:
                        logger.warning("LLM normalization failed: %s", exc)
                        llm_info = {
                            "called": True,
                            "normalized": None,
                            "error": str(exc),
                        }

                if grading_trace is not None and llm_info is not None:
                    grading_trace["llm"] = llm_info

                if is_correct is None:
                    is_correct, score = False, 0
        else:
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
                data.assessment_id,
            )
            submission: SubmissionModel = await self.submissions_repo.create_submission(
                user_id=user_id,
                problem_id=data.problem_id,
                assessment_id=data.assessment_id,
                attempt_no=attempt_no,
                status=status,
                is_correct=is_correct,
                score=score,
                answer_text=answer.answer_text or (
                    str(answer.answer_numeric)
                    if answer.answer_numeric is not None
                    else None
                ),
                answer_numeric=float(answer.answer_numeric)
                if answer.answer_numeric is not None
                else None,
                grading_trace=grading_trace,
            )

            if answer.choice_ids:
                await self.submissions_repo.set_submission_choices(
                    submission,
                    answer.choice_ids,
                )

        created_at = submission.submitted_at or datetime.now(timezone.utc)
        message = tr("graded") if status is SubmissionStatus.GRADED else tr("sent_to_review")

        return SubmissionResultOut(
            submission_id=submission.id,
            problem_id=submission.problem_id,
            status=status,
            is_correct=is_correct,
            score=score,
            created_at=created_at,
            message=message,
        )

    async def get_last_progress(
        self,
        user_id: uuid.UUID,
        problem_id: uuid.UUID,
        assessment_id: uuid.UUID | None = None,
    ) -> SubmissionProgressOut:
        sub = await self.submissions_repo.get_last_for_user_problem(
            user_id,
            problem_id,
            assessment_id,
        )
        if sub is None:
            return SubmissionProgressOut(has_attempt=False)

        choice_ids = await self.submissions_repo.get_choice_ids_for_submission(sub.id)
        return SubmissionProgressOut(
            has_attempt=True,
            last_status=SubmissionStatus(sub.status) if sub.status else None,
            last_is_correct=sub.is_correct,
            last_score=sub.score,
            last_answer_choice_ids=choice_ids or None,
            last_answer_text=sub.answer_text,
            last_created_at=sub.submitted_at,
        )

    async def get_progress_batch(
        self,
        user_id: uuid.UUID,
        problem_ids: list[uuid.UUID],
        assessment_id: uuid.UUID | None = None,
    ) -> list[SubmissionProgressItemOut]:
        if not problem_ids:
            return []
        subs = await self.submissions_repo.get_last_for_user_problems(
            user_id,
            problem_ids,
            assessment_id,
        )
        if not subs:
            return [
                SubmissionProgressItemOut(problem_id=pid, has_attempt=False)
                for pid in problem_ids
            ]
        submission_ids = [s.id for s in subs]
        choice_map = await self.submissions_repo.get_choice_ids_for_submissions(submission_ids)
        sub_by_id = {s.id: s for s in subs}
        items: list[SubmissionProgressItemOut] = []
        for pid in problem_ids:
            sub = next((s for s in subs if s.problem_id == pid), None)
            if sub is None:
                items.append(SubmissionProgressItemOut(problem_id=pid, has_attempt=False))
                continue
            choice_ids = choice_map.get(sub.id) or []
            items.append(
                SubmissionProgressItemOut(
                    problem_id=pid,
                    has_attempt=True,
                    last_status=SubmissionStatus(sub.status) if sub.status else None,
                    last_is_correct=sub.is_correct,
                    last_score=sub.score,
                    last_answer_choice_ids=choice_ids or None,
                    last_answer_text=sub.answer_text,
                    last_created_at=sub.submitted_at,
                )
            )
        return items
