from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel


class XpOut(BaseModel):
    total_xp: int


class StreakOut(BaseModel):
    current_streak: int
    longest_streak: int
    last_activity_date: date | None


class AchievementOut(BaseModel):
    id: uuid.UUID
    code: str
    title: str
    description: str | None
    icon_name: str | None
    icon_url: str | None
    xp_reward: int | None
    is_active: bool
    trigger_type: str | None
    created_at: datetime
    updated_at: datetime
    unlocked_at: datetime | None = None
    is_unlocked: bool


class AchievementListOut(BaseModel):
    items: list[AchievementOut]
    unlocked_count: int
    total: int


class LeaderboardMetric(str, Enum):
    XP = "xp"
    SOLVED_PROBLEMS = "solved_problems"
    STREAK = "streak"


class LeaderboardEntryOut(BaseModel):
    rank: int
    user_id: uuid.UUID
    display_name: str
    avatar_url: str | None
    city: str | None
    score: int
    is_me: bool = False


class LeaderboardOut(BaseModel):
    metric: LeaderboardMetric
    items: list[LeaderboardEntryOut]
    my_entry: LeaderboardEntryOut | None = None
