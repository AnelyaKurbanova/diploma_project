from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.activity.data.models import UserActivityEventModel


class ActivityRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add_event(
        self,
        event_type: str,
        user_id: uuid.UUID | None,
        path: str | None,
        ip: str | None,
        user_agent: str | None,
        meta: dict[str, Any] | None = None,
    ) -> UserActivityEventModel:
        row = UserActivityEventModel(
            event_type=event_type,
            user_id=user_id,
            path=path,
            ip=ip,
            user_agent=user_agent,
            meta=meta or {},
        )
        self.session.add(row)
        await self.session.flush()
        return row

