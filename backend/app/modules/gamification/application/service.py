from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.gamification.api.schemas import (
    AchievementListOut,
    AchievementOut,
    LeaderboardEntryOut,
    LeaderboardMetric,
    LeaderboardOut,
    StreakOut,
    XpOut,
)
from app.modules.gamification.data.models import AchievementModel, UserAchievementModel
from app.modules.gamification.data.repo import (
    PROBLEM_DIFFICULTY_XP,
    AchievementRepo,
    GamificationStatsRepo,
    UserAchievementRepo,
    UserStreakRepo,
    UserXpRepo,
)
from app.modules.problems.data.models import ProblemDifficulty


logger = logging.getLogger(__name__)

DEFAULT_TIMEZONE = "Asia/Almaty"
LESSON_COMPLETED_XP = 5
WATCHED_VIDEO_XP = 10


@dataclass(frozen=True)
class AchievementRule:
    code: str
    trigger_type: str
    threshold: int


ACHIEVEMENT_RULES: tuple[AchievementRule, ...] = (
    AchievementRule("first_solution", "problems_solved", 1),
    AchievementRule("problems_10", "problems_solved", 10),
    AchievementRule("first_lesson", "lessons_completed", 1),
    AchievementRule("lessons_10", "lessons_completed", 10),
    AchievementRule("streak_3", "streak_days", 3),
    AchievementRule("streak_7", "streak_days", 7),
    AchievementRule("xp_100", "xp_total", 100),
    AchievementRule("xp_500", "xp_total", 500),
)


class GamificationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.achievement_repo = AchievementRepo(session)
        self.user_achievement_repo = UserAchievementRepo(session)
        self.user_streak_repo = UserStreakRepo(session)
        self.user_xp_repo = UserXpRepo(session)
        self.stats_repo = GamificationStatsRepo(session)

    async def _get_or_create_xp_row(
        self,
        user_id: uuid.UUID,
        *,
        for_update: bool = False,
    ):
        row = await self.user_xp_repo.get_by_user_id(user_id, for_update=for_update)
        if row is not None:
            return row
        try:
            async with self.session.begin_nested():
                row = await self.user_xp_repo.create(user_id)
            return row
        except IntegrityError:
            row = await self.user_xp_repo.get_by_user_id(user_id, for_update=for_update)
            if row is None:
                raise
            return row

    async def _get_or_create_streak_row(
        self,
        user_id: uuid.UUID,
        *,
        for_update: bool = False,
    ):
        row = await self.user_streak_repo.get_by_user_id(user_id, for_update=for_update)
        if row is not None:
            return row
        try:
            async with self.session.begin_nested():
                row = await self.user_streak_repo.create(user_id)
            return row
        except IntegrityError:
            row = await self.user_streak_repo.get_by_user_id(user_id, for_update=for_update)
            if row is None:
                raise
            return row

    async def _current_activity_date(
        self,
        user_id: uuid.UUID,
        occurred_at: datetime | None = None,
    ):
        occurred_at = occurred_at or datetime.now(timezone.utc)
        if occurred_at.tzinfo is None:
            occurred_at = occurred_at.replace(tzinfo=timezone.utc)

        timezone_name = await self.stats_repo.get_user_timezone(user_id) or DEFAULT_TIMEZONE
        try:
            tz = ZoneInfo(timezone_name)
        except ZoneInfoNotFoundError:
            tz = ZoneInfo(DEFAULT_TIMEZONE)
        return occurred_at.astimezone(tz).date()

    @staticmethod
    def _to_achievement_out(
        achievement: AchievementModel,
        unlocked: UserAchievementModel | None,
    ) -> AchievementOut:
        return AchievementOut(
            id=achievement.id,
            code=achievement.code,
            title=achievement.title,
            description=achievement.description,
            icon_name=achievement.icon_name,
            icon_url=achievement.icon_url,
            xp_reward=achievement.xp_reward,
            is_active=achievement.is_active,
            trigger_type=achievement.trigger_type,
            created_at=achievement.created_at,
            updated_at=achievement.updated_at,
            unlocked_at=unlocked.unlocked_at if unlocked else None,
            is_unlocked=unlocked is not None,
        )

    async def get_my_xp(self, user_id: uuid.UUID) -> XpOut:
        row = await self.user_xp_repo.get_by_user_id(user_id)
        return XpOut(total_xp=row.total_xp if row else 0)

    async def get_my_streak(self, user_id: uuid.UUID) -> StreakOut:
        row = await self.user_streak_repo.get_by_user_id(user_id)
        if row is None:
            return StreakOut(
                current_streak=0,
                longest_streak=0,
                last_activity_date=None,
            )
        return StreakOut(
            current_streak=row.current_streak,
            longest_streak=row.longest_streak,
            last_activity_date=row.last_activity_date,
        )

    async def list_my_achievements(self, user_id: uuid.UUID) -> AchievementListOut:
        rows = await self.achievement_repo.list_for_user(user_id, only_active=True)
        unlocked_count = sum(1 for _achievement, unlocked in rows if unlocked is not None)
        return AchievementListOut(
            items=[
                self._to_achievement_out(achievement, unlocked)
                for achievement, unlocked in rows
            ],
            unlocked_count=unlocked_count,
            total=len(rows),
        )

    async def get_leaderboard(
        self,
        metric: LeaderboardMetric,
        *,
        current_user_id: uuid.UUID,
        limit: int = 20,
    ) -> LeaderboardOut:
        items, my_entry = await self.stats_repo.get_leaderboard(
            metric,
            limit=limit,
            current_user_id=current_user_id,
        )

        return LeaderboardOut(
            metric=metric,
            items=[
                LeaderboardEntryOut(
                    rank=item.rank,
                    user_id=item.user_id,
                    display_name=item.display_name,
                    avatar_url=item.avatar_url,
                    city=item.city,
                    score=item.score,
                    is_me=item.user_id == current_user_id,
                )
                for item in items
            ],
            my_entry=(
                LeaderboardEntryOut(
                    rank=my_entry.rank,
                    user_id=my_entry.user_id,
                    display_name=my_entry.display_name,
                    avatar_url=my_entry.avatar_url,
                    city=my_entry.city,
                    score=my_entry.score,
                    is_me=my_entry.user_id == current_user_id,
                )
                if my_entry is not None
                else None
            ),
        )

    async def touch_daily_streak(
        self,
        user_id: uuid.UUID,
        *,
        occurred_at: datetime | None = None,
    ) -> bool:
        streak_row = await self._get_or_create_streak_row(user_id, for_update=True)
        activity_date = await self._current_activity_date(user_id, occurred_at)
        updated = await self.user_streak_repo.apply_activity(streak_row, activity_date)
        return updated

    async def add_problem_solution_xp(
        self,
        user_id: uuid.UUID,
        *,
        problem_id: uuid.UUID,
        difficulty: ProblemDifficulty,
        submission_id: uuid.UUID,
    ) -> int:
        xp_row = await self._get_or_create_xp_row(user_id, for_update=True)
        already_solved = await self.stats_repo.has_prior_correct_submission(
            user_id,
            problem_id,
            exclude_submission_id=submission_id,
        )
        if already_solved:
            return 0

        xp_amount = PROBLEM_DIFFICULTY_XP[difficulty]
        await self.user_xp_repo.add_xp(xp_row, xp_amount)
        return xp_amount

    async def add_lesson_completion_xp(
        self,
        user_id: uuid.UUID,
        *,
        was_first_completion: bool,
    ) -> int:
        if not was_first_completion:
            return 0
        xp_row = await self._get_or_create_xp_row(user_id, for_update=True)
        await self.user_xp_repo.add_xp(xp_row, LESSON_COMPLETED_XP)
        return LESSON_COMPLETED_XP

    async def on_problem_submission(
        self,
        user_id: uuid.UUID,
        *,
        problem_id: uuid.UUID,
        difficulty: ProblemDifficulty,
        submission_id: uuid.UUID,
        is_correct: bool | None,
        occurred_at: datetime | None = None,
    ) -> None:
        await self.touch_daily_streak(user_id, occurred_at=occurred_at)
        if is_correct is True:
            await self.add_problem_solution_xp(
                user_id,
                problem_id=problem_id,
                difficulty=difficulty,
                submission_id=submission_id,
            )
        await self.sync_achievements(user_id)

    async def on_lesson_completed(
        self,
        user_id: uuid.UUID,
        *,
        was_first_completion: bool,
        occurred_at: datetime | None = None,
    ) -> None:
        await self.touch_daily_streak(user_id, occurred_at=occurred_at)
        await self.add_lesson_completion_xp(
            user_id,
            was_first_completion=was_first_completion,
        )
        await self.sync_achievements(user_id)

    async def sync_achievements(self, user_id: uuid.UUID) -> None:
        xp_row = await self.user_xp_repo.get_by_user_id(user_id)
        streak_row = await self.user_streak_repo.get_by_user_id(user_id)
        solved_count = await self.stats_repo.count_solved_problems(user_id)
        lessons_count = await self.stats_repo.count_completed_lessons(user_id)
        total_xp = xp_row.total_xp if xp_row else 0
        longest_streak = streak_row.longest_streak if streak_row else 0

        available = await self.achievement_repo.get_active_by_codes(
            [rule.code for rule in ACHIEVEMENT_RULES]
        )

        for rule in ACHIEVEMENT_RULES:
            achievement = available.get(rule.code)
            if achievement is None:
                continue

            current_value = 0
            if rule.trigger_type == "problems_solved":
                current_value = solved_count
            elif rule.trigger_type == "lessons_completed":
                current_value = lessons_count
            elif rule.trigger_type == "streak_days":
                current_value = longest_streak
            elif rule.trigger_type == "xp_total":
                current_value = total_xp

            if current_value < rule.threshold:
                continue

            already_unlocked = await self.user_achievement_repo.has_unlocked(
                user_id,
                achievement.id,
            )
            if already_unlocked:
                continue

            try:
                async with self.session.begin_nested():
                    await self.user_achievement_repo.unlock(user_id, achievement.id)
            except IntegrityError:
                logger.info(
                    "Achievement already unlocked concurrently",
                    extra={
                        "user_id": str(user_id),
                        "achievement_code": achievement.code,
                    },
                )
