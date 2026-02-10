from __future__ import annotations
import logging
import uuid
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.auth.data.repo import AuthRepo

logger = logging.getLogger("auth.audit")


class AuditService:
    def __init__(self, session: AsyncSession):
        self.repo = AuthRepo(session)

    async def log(
        self,
        event_type: str,
        user_id: uuid.UUID | None = None,
        ip: str | None = None,
        user_agent: str | None = None,
        meta: dict[str, Any] | None = None,
    ):
        await self.repo.add_security_event(event_type, user_id, ip, user_agent, meta or {})
        logger.info(
            "security_event",
            extra={
                "event_type": event_type,
                "user_id": str(user_id) if user_id else None,
                "ip": ip,
                "user_agent": user_agent,
                "meta": meta or {},
            },
        )
