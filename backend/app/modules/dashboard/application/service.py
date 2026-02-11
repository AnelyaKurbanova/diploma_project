from __future__ import annotations

import uuid

from sqlalchemy import select, func, case, distinct, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.catalog.data.models import SubjectModel, TopicModel
from app.modules.lessons.data.models import LessonModel, LessonProgressModel
from app.modules.problems.data.models import ProblemModel, ProblemStatus
from app.modules.submissions.data.models import SubmissionModel, SubmissionStatus
from app.modules.dashboard.api.schemas import (
    DashboardStatsOut,
    SubjectProgressOut,
    TaskDistributionOut,
    RecommendationOut,
)


class DashboardService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_stats(self, user_id: uuid.UUID) -> DashboardStatsOut:
        completed_lectures = await self._count_completed_lectures(user_id)
        total_lectures = await self._count_total_lectures()
        task_stats = await self._get_task_stats(user_id)
        subjects_progress = await self._get_subjects_progress(user_id)
        recommendations = self._build_recommendations(subjects_progress)

        total_solved = task_stats["correct"] + task_stats["incorrect"]
        total_tasks = task_stats["total"]
        accuracy = (
            round(task_stats["correct"] / total_solved * 100)
            if total_solved > 0
            else 0
        )

        overall_parts: list[int] = []
        if total_lectures > 0:
            overall_parts.append(round(completed_lectures / total_lectures * 100))
        if total_tasks > 0:
            overall_parts.append(round(total_solved / total_tasks * 100))
        overall_progress = (
            round(sum(overall_parts) / len(overall_parts)) if overall_parts else 0
        )

        return DashboardStatsOut(
            overall_progress=overall_progress,
            completed_lectures=completed_lectures,
            total_lectures=total_lectures,
            solved_tasks=total_solved,
            total_tasks=total_tasks,
            accuracy=accuracy,
            subjects_progress=subjects_progress,
            task_distribution=TaskDistributionOut(
                correct=task_stats["correct"],
                incorrect=task_stats["incorrect"],
                unsolved=task_stats["unsolved"],
            ),
            recommendations=recommendations,
        )

    async def _count_completed_lectures(self, user_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(LessonProgressModel)
            .where(
                LessonProgressModel.user_id == user_id,
                LessonProgressModel.completed.is_(True),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def _count_total_lectures(self) -> int:
        stmt = select(func.count()).select_from(LessonModel)
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def _get_task_stats(self, user_id: uuid.UUID) -> dict:
        total_stmt = (
            select(func.count())
            .select_from(ProblemModel)
            .where(ProblemModel.status == ProblemStatus.PUBLISHED)
        )
        total_result = await self.session.execute(total_stmt)
        total = total_result.scalar_one()

        graded_stmt = (
            select(
                func.count().label("total_graded"),
                func.count()
                .filter(SubmissionModel.is_correct.is_(True))
                .label("correct"),
                func.count()
                .filter(SubmissionModel.is_correct.is_(False))
                .label("incorrect"),
            )
            .select_from(SubmissionModel)
            .where(
                SubmissionModel.user_id == user_id,
                SubmissionModel.status == SubmissionStatus.GRADED,
            )
        )
        graded_result = await self.session.execute(graded_stmt)
        row = graded_result.one()

        correct = row.correct or 0
        incorrect = row.incorrect or 0
        solved_problem_count = correct + incorrect
        unsolved = max(total - solved_problem_count, 0)

        return {
            "total": total,
            "correct": correct,
            "incorrect": incorrect,
            "unsolved": unsolved,
        }

    async def _get_subjects_progress(
        self, user_id: uuid.UUID
    ) -> list[SubjectProgressOut]:
        subjects_stmt = select(SubjectModel).order_by(SubjectModel.name_ru)
        subjects_result = await self.session.execute(subjects_stmt)
        subjects = subjects_result.scalars().all()

        progress_list: list[SubjectProgressOut] = []

        for subject in subjects:
            total_topics_stmt = (
                select(func.count())
                .select_from(TopicModel)
                .where(TopicModel.subject_id == subject.id)
            )
            total_topics_result = await self.session.execute(total_topics_stmt)
            total_topics = total_topics_result.scalar_one()
            if total_topics == 0:
                continue

            completed_topics_stmt = (
                select(func.count(distinct(ProblemModel.topic_id)))
                .select_from(SubmissionModel)
                .join(ProblemModel, SubmissionModel.problem_id == ProblemModel.id)
                .where(
                    SubmissionModel.user_id == user_id,
                    SubmissionModel.is_correct.is_(True),
                    ProblemModel.subject_id == subject.id,
                    ProblemModel.topic_id.isnot(None),
                )
            )
            completed_topics_result = await self.session.execute(completed_topics_stmt)
            completed_topics = completed_topics_result.scalar_one()

            mastery = round(completed_topics / total_topics * 100) if total_topics > 0 else 0

            progress_list.append(
                SubjectProgressOut(
                    code=subject.code,
                    name=subject.name_ru,
                    mastery=mastery,
                    completed_topics=completed_topics,
                    total_topics=total_topics,
                )
            )

        return progress_list

    @staticmethod
    def _build_recommendations(
        subjects: list[SubjectProgressOut],
    ) -> list[RecommendationOut]:
        recs: list[RecommendationOut] = []
        for s in sorted(subjects, key=lambda x: x.mastery):
            if s.mastery < 70:
                recs.append(
                    RecommendationOut(
                        subject_code=s.code,
                        subject_name=s.name,
                        mastery=s.mastery,
                        message=f"Освоение: {s.mastery}% \u2014 требуется больше практики",
                    )
                )
            if len(recs) >= 3:
                break
        return recs
