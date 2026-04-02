from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.modules.auth.deps import get_current_user
from app.modules.gamification.api.schemas import (
    AchievementListOut,
    LeaderboardMetric,
    LeaderboardOut,
    StreakOut,
    XpOut,
)
from app.modules.gamification.application.service import GamificationService


router = APIRouter(tags=["gamification"])
me_router = APIRouter(prefix="/me")


@me_router.get("/xp", response_model=XpOut)
async def get_my_xp(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = GamificationService(session)
    return await svc.get_my_xp(current_user.id)


@me_router.get("/streak", response_model=StreakOut)
async def get_my_streak(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = GamificationService(session)
    return await svc.get_my_streak(current_user.id)


@me_router.get("/achievements", response_model=AchievementListOut)
async def get_my_achievements(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = GamificationService(session)
    return await svc.list_my_achievements(current_user.id)


@router.get("/leaderboard", response_model=LeaderboardOut)
async def get_leaderboard(
    metric: LeaderboardMetric = Query(default=LeaderboardMetric.XP),
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = GamificationService(session)
    return await svc.get_leaderboard(
        metric,
        current_user_id=current_user.id,
        limit=limit,
    )


router.include_router(me_router)
