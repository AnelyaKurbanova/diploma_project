from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.modules.gamification.application.service import GamificationService


class FakeSession:
    def begin_nested(self):
        class _Tx:
            async def __aenter__(self_inner):                
                return None

            async def __aexit__(self_inner, exc_type, exc, tb):                
                return False

        return _Tx()


class FakeAchievementRepo:
    def __init__(self, achievement):
        self.achievement = achievement

    async def get_active_by_codes(self, _codes):
        return {self.achievement.code: self.achievement}


class FakeUserAchievementRepo:
    def __init__(self):
        self.unlocked: list[tuple[uuid.UUID, uuid.UUID]] = []

    async def has_unlocked(self, _user_id: uuid.UUID, _achievement_id: uuid.UUID) -> bool:
        return False

    async def unlock(self, user_id: uuid.UUID, achievement_id: uuid.UUID):
        self.unlocked.append((user_id, achievement_id))
        return SimpleNamespace(user_id=user_id, achievement_id=achievement_id)


class FakeUserAchievementRepoAlreadyUnlocked(FakeUserAchievementRepo):
    async def has_unlocked(self, _user_id: uuid.UUID, _achievement_id: uuid.UUID) -> bool:
        return True


class FakeStatsRepo:
    async def count_solved_problems(self, _user_id: uuid.UUID) -> int:
        return 1

    async def count_completed_lessons(self, _user_id: uuid.UUID) -> int:
        return 0


class FakeNotificationRepo:
    def __init__(self):
        self.created: list[dict] = []

    async def create(self, **kwargs):
        self.created.append(kwargs)
        return SimpleNamespace(**kwargs)


class FakeOptionalRowRepo:
    async def get_by_user_id(self, _user_id: uuid.UUID):
        return None


@pytest.mark.asyncio
async def test_sync_achievements_creates_notification_for_new_unlock():
    user_id = uuid.uuid4()
    achievement = SimpleNamespace(
        id=uuid.uuid4(),
        code="first_solution",
        title="Первое решение",
    )

    service = GamificationService(FakeSession())
    service.achievement_repo = FakeAchievementRepo(achievement)
    service.user_achievement_repo = FakeUserAchievementRepo()
    service.user_streak_repo = FakeOptionalRowRepo()
    service.user_xp_repo = FakeOptionalRowRepo()
    service.stats_repo = FakeStatsRepo()
    service.notification_repo = FakeNotificationRepo()

    await service.sync_achievements(user_id)

    assert service.user_achievement_repo.unlocked == [(user_id, achievement.id)]
    assert len(service.notification_repo.created) == 1
    assert service.notification_repo.created[0]["type"] == "achievement_unlocked"
    assert service.notification_repo.created[0]["user_id"] == user_id


@pytest.mark.asyncio
async def test_sync_achievements_skips_notification_for_existing_unlock():
    user_id = uuid.uuid4()
    achievement = SimpleNamespace(
        id=uuid.uuid4(),
        code="first_solution",
        title="Первое решение",
    )

    service = GamificationService(FakeSession())
    service.achievement_repo = FakeAchievementRepo(achievement)
    service.user_achievement_repo = FakeUserAchievementRepoAlreadyUnlocked()
    service.user_streak_repo = FakeOptionalRowRepo()
    service.user_xp_repo = FakeOptionalRowRepo()
    service.stats_repo = FakeStatsRepo()
    service.notification_repo = FakeNotificationRepo()

    await service.sync_achievements(user_id)

    assert service.user_achievement_repo.unlocked == []
    assert service.notification_repo.created == []
