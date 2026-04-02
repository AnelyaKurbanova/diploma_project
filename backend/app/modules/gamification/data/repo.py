from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date
from typing import Sequence

from sqlalchemy import Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.gamification.api.schemas import LeaderboardMetric
from app.modules.gamification.data.models import (
    AchievementModel,
    UserAchievementModel,
    UserStreakModel,
    UserXpModel,
)
from app.modules.lessons.data.models import LessonProgressModel
from app.modules.problems.data.models import ProblemDifficulty
from app.modules.submissions.data.models import SubmissionModel, SubmissionStatus
from app.modules.users.data.models import UserModel, UserProfileModel, UserRole


@dataclass(frozen=True)
class LeaderboardEntry:
    rank: int
    user_id: uuid.UUID
    display_name: str
    avatar_url: str | None
    city: str | None
    score: int


class AchievementRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def count_active(self) -> int:
        stmt = (
            select(func.count())
            .select_from(AchievementModel)
            .where(AchievementModel.is_active.is_(True))
        )
        return int((await self.session.execute(stmt)).scalar_one())

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        only_active: bool = True,
    ) -> list[tuple[AchievementModel, UserAchievementModel | None]]:
        stmt: Select = (
            select(AchievementModel, UserAchievementModel)
            .outerjoin(
                UserAchievementModel,
                and_(
                    UserAchievementModel.achievement_id == AchievementModel.id,
                    UserAchievementModel.user_id == user_id,
                ),
            )
            .order_by(
                UserAchievementModel.unlocked_at.desc().nullslast(),
                AchievementModel.created_at.asc(),
            )
        )
        if only_active:
            stmt = stmt.where(AchievementModel.is_active.is_(True))
        rows = (await self.session.execute(stmt)).all()
        return list(rows)

    async def get_active_by_codes(
        self,
        codes: Sequence[str],
    ) -> dict[str, AchievementModel]:
        if not codes:
            return {}
        stmt = select(AchievementModel).where(
            AchievementModel.code.in_(codes),
            AchievementModel.is_active.is_(True),
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return {row.code: row for row in rows}


class UserAchievementRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def count_unlocked(self, user_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(UserAchievementModel)
            .where(UserAchievementModel.user_id == user_id)
        )
        return int((await self.session.execute(stmt)).scalar_one())

    async def has_unlocked(self, user_id: uuid.UUID, achievement_id: uuid.UUID) -> bool:
        stmt = (
            select(UserAchievementModel.id)
            .where(
                UserAchievementModel.user_id == user_id,
                UserAchievementModel.achievement_id == achievement_id,
            )
            .limit(1)
        )
        return (await self.session.execute(stmt)).first() is not None

    async def unlock(
        self,
        user_id: uuid.UUID,
        achievement_id: uuid.UUID,
    ) -> UserAchievementModel:
        row = UserAchievementModel(
            user_id=user_id,
            achievement_id=achievement_id,
        )
        self.session.add(row)
        await self.session.flush()
        return row


class UserStreakRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_user_id(
        self,
        user_id: uuid.UUID,
        *,
        for_update: bool = False,
    ) -> UserStreakModel | None:
        stmt = select(UserStreakModel).where(UserStreakModel.user_id == user_id)
        if for_update:
            stmt = stmt.with_for_update()
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def create(self, user_id: uuid.UUID) -> UserStreakModel:
        row = UserStreakModel(user_id=user_id)
        self.session.add(row)
        await self.session.flush()
        return row

    async def apply_activity(
        self,
        row: UserStreakModel,
        activity_date: date,
    ) -> bool:
        if row.last_activity_date == activity_date:
            return False

        if row.last_activity_date is None:
            row.current_streak = 1
        else:
            day_delta = (activity_date - row.last_activity_date).days
            if day_delta == 1:
                row.current_streak += 1
            elif day_delta > 1:
                row.current_streak = 1

        if row.current_streak > row.longest_streak:
            row.longest_streak = row.current_streak
        row.last_activity_date = activity_date
        await self.session.flush()
        return True


class UserXpRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_user_id(
        self,
        user_id: uuid.UUID,
        *,
        for_update: bool = False,
    ) -> UserXpModel | None:
        stmt = select(UserXpModel).where(UserXpModel.user_id == user_id)
        if for_update:
            stmt = stmt.with_for_update()
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def create(self, user_id: uuid.UUID) -> UserXpModel:
        row = UserXpModel(user_id=user_id)
        self.session.add(row)
        await self.session.flush()
        return row

    async def add_xp(self, row: UserXpModel, amount: int) -> UserXpModel:
        row.total_xp += amount
        await self.session.flush()
        return row


class GamificationStatsRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def has_prior_correct_submission(
        self,
        user_id: uuid.UUID,
        problem_id: uuid.UUID,
        *,
        exclude_submission_id: uuid.UUID | None = None,
    ) -> bool:
        stmt = (
            select(SubmissionModel.id)
            .where(
                SubmissionModel.user_id == user_id,
                SubmissionModel.problem_id == problem_id,
                SubmissionModel.status == SubmissionStatus.GRADED.value,
                SubmissionModel.is_correct.is_(True),
            )
            .limit(1)
        )
        if exclude_submission_id is not None:
            stmt = stmt.where(SubmissionModel.id != exclude_submission_id)
        return (await self.session.execute(stmt)).first() is not None

    async def count_solved_problems(self, user_id: uuid.UUID) -> int:
        stmt = (
            select(func.count(func.distinct(SubmissionModel.problem_id)))
            .where(
                SubmissionModel.user_id == user_id,
                SubmissionModel.status == SubmissionStatus.GRADED.value,
                SubmissionModel.is_correct.is_(True),
            )
        )
        return int((await self.session.execute(stmt)).scalar_one() or 0)

    async def count_completed_lessons(self, user_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(LessonProgressModel)
            .where(
                LessonProgressModel.user_id == user_id,
                LessonProgressModel.completed.is_(True),
            )
        )
        return int((await self.session.execute(stmt)).scalar_one() or 0)

    async def get_user_timezone(self, user_id: uuid.UUID) -> str | None:
        stmt = (
            select(UserProfileModel.timezone)
            .where(UserProfileModel.user_id == user_id)
            .limit(1)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_leaderboard(
        self,
        metric: LeaderboardMetric,
        *,
        limit: int,
        current_user_id: uuid.UUID | None = None,
    ) -> tuple[list[LeaderboardEntry], LeaderboardEntry | None]:
        score_source = None

        if metric == LeaderboardMetric.XP:
            score_source = UserXpModel.total_xp
            stmt = (
                select(
                    UserModel.id.label("user_id"),
                    UserModel.email.label("email"),
                    UserProfileModel.full_name.label("full_name"),
                    UserProfileModel.avatar_url.label("avatar_url"),
                    UserProfileModel.city.label("city"),
                    func.coalesce(score_source, 0).label("score"),
                    UserModel.created_at.label("sort_created_at"),
                )
                .select_from(UserModel)
                .outerjoin(UserProfileModel, UserProfileModel.user_id == UserModel.id)
                .outerjoin(UserXpModel, UserXpModel.user_id == UserModel.id)
                .where(
                    UserModel.is_active.is_(True),
                    UserModel.role == UserRole.STUDENT,
                    func.coalesce(score_source, 0) > 0,
                )
            )
        elif metric == LeaderboardMetric.STREAK:
            score_source = UserStreakModel.current_streak
            stmt = (
                select(
                    UserModel.id.label("user_id"),
                    UserModel.email.label("email"),
                    UserProfileModel.full_name.label("full_name"),
                    UserProfileModel.avatar_url.label("avatar_url"),
                    UserProfileModel.city.label("city"),
                    func.coalesce(score_source, 0).label("score"),
                    UserModel.created_at.label("sort_created_at"),
                )
                .select_from(UserModel)
                .outerjoin(UserProfileModel, UserProfileModel.user_id == UserModel.id)
                .outerjoin(UserStreakModel, UserStreakModel.user_id == UserModel.id)
                .where(
                    UserModel.is_active.is_(True),
                    UserModel.role == UserRole.STUDENT,
                    func.coalesce(score_source, 0) > 0,
                )
            )
        else:
            solved_subquery = (
                select(
                    SubmissionModel.user_id.label("user_id"),
                    func.count(func.distinct(SubmissionModel.problem_id)).label("score"),
                )
                .where(
                    SubmissionModel.status == SubmissionStatus.GRADED.value,
                    SubmissionModel.is_correct.is_(True),
                )
                .group_by(SubmissionModel.user_id)
                .subquery()
            )
            stmt = (
                select(
                    UserModel.id.label("user_id"),
                    UserModel.email.label("email"),
                    UserProfileModel.full_name.label("full_name"),
                    UserProfileModel.avatar_url.label("avatar_url"),
                    UserProfileModel.city.label("city"),
                    func.coalesce(solved_subquery.c.score, 0).label("score"),
                    UserModel.created_at.label("sort_created_at"),
                )
                .select_from(UserModel)
                .outerjoin(UserProfileModel, UserProfileModel.user_id == UserModel.id)
                .outerjoin(solved_subquery, solved_subquery.c.user_id == UserModel.id)
                .where(
                    UserModel.is_active.is_(True),
                    UserModel.role == UserRole.STUDENT,
                    func.coalesce(solved_subquery.c.score, 0) > 0,
                )
            )

        base_subquery = stmt.subquery()
        ranked_subquery = (
            select(
                base_subquery.c.user_id,
                base_subquery.c.email,
                base_subquery.c.full_name,
                base_subquery.c.avatar_url,
                base_subquery.c.city,
                base_subquery.c.score,
                func.row_number()
                .over(
                    order_by=(
                        base_subquery.c.score.desc(),
                        base_subquery.c.sort_created_at.asc(),
                        base_subquery.c.user_id.asc(),
                    )
                )
                .label("rank"),
            )
            .subquery()
        )

        top_stmt = select(ranked_subquery).order_by(ranked_subquery.c.rank.asc()).limit(limit)
        top_rows = (await self.session.execute(top_stmt)).all()
        top_entries = [self._to_leaderboard_entry(row) for row in top_rows]

        my_entry = None
        if current_user_id is not None:
            my_stmt = (
                select(ranked_subquery)
                .where(ranked_subquery.c.user_id == current_user_id)
                .limit(1)
            )
            my_row = (await self.session.execute(my_stmt)).first()
            if my_row is not None:
                my_entry = self._to_leaderboard_entry(my_row)

        return top_entries, my_entry

    @staticmethod
    def _to_leaderboard_entry(row) -> LeaderboardEntry:
        display_name = row.full_name if row.full_name else str(row.email).split("@")[0]
        return LeaderboardEntry(
            rank=int(row.rank),
            user_id=row.user_id,
            display_name=display_name,
            avatar_url=row.avatar_url,
            city=row.city,
            score=int(row.score or 0),
        )


PROBLEM_DIFFICULTY_XP: dict[ProblemDifficulty, int] = {
    ProblemDifficulty.EASY: 10,
    ProblemDifficulty.MEDIUM: 25,
    ProblemDifficulty.HARD: 50,
}
