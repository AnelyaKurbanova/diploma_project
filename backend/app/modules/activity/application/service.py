from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.activity.data.repo import ActivityRepo


logger = logging.getLogger("activity.events")


class ActivityService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = ActivityRepo(session)

    async def log(
        self,
        event_type: str,
        user_id: uuid.UUID | None = None,
        *,
        path: str | None = None,
        ip: str | None = None,
        user_agent: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> None:
        try:
            await self.repo.add_event(
                event_type=event_type,
                user_id=user_id,
                path=path,
                ip=ip,
                user_agent=user_agent,
                meta=meta or {},
            )
            logger.info(
                "activity_event",
                extra={
                    "event_type": event_type,
                    "user_id": str(user_id) if user_id else None,
                    "path": path,
                    "ip": ip,
                    "user_agent": user_agent,
                    "meta": meta or {},
                },
            )
        except Exception as exc:  
            logger.warning("Failed to log activity event %s: %s", event_type, exc)

