from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.modules.auth.deps import get_current_user
from app.modules.dashboard.api.schemas import DashboardStatsOut
from app.modules.dashboard.application.service import DashboardService

router = APIRouter(prefix="/me", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardStatsOut)
async def get_dashboard(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = DashboardService(session)
    return await svc.get_stats(current_user.id)
