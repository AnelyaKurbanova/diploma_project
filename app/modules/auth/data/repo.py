from __future__ import annotations
import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.auth.data.models import (
    AuthAccountModel, EmailVerificationModel, RefreshSessionModel, SecurityEventModel
)
from app.modules.auth.security.tokens import now_utc


class AuthRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_auth_account(self, provider: str, provider_user_id: str) -> AuthAccountModel | None:
        q = select(AuthAccountModel).where(
            AuthAccountModel.provider == provider,
            AuthAccountModel.provider_user_id == provider_user_id,
        )
        return (await self.session.execute(q)).scalars().first()

    async def create_auth_account(self, user_id: uuid.UUID, provider: str, provider_user_id: str):
        row = AuthAccountModel(
            user_id=user_id,
            provider=provider,
            provider_user_id=provider_user_id,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def get_latest_active_verification(self, user_id: uuid.UUID, purpose: str) -> EmailVerificationModel | None:
        q = (
            select(EmailVerificationModel)
            .where(
                EmailVerificationModel.user_id == user_id,
                EmailVerificationModel.purpose == purpose,
                EmailVerificationModel.consumed_at.is_(None),
            )
            .order_by(EmailVerificationModel.created_at.desc())
        )
        return (await self.session.execute(q)).scalars().first()

    async def upsert_verification(self, user_id: uuid.UUID, purpose: str, code_hash: str, expires_at, resend_not_before):
        row = await self.get_latest_active_verification(user_id, purpose)
        if row:
            row.code_hash = code_hash
            row.expires_at = expires_at
            row.attempts = 0
            row.resend_not_before = resend_not_before
            return row
        row = EmailVerificationModel(
            user_id=user_id,
            purpose=purpose,
            code_hash=code_hash,
            expires_at=expires_at,
            resend_not_before=resend_not_before,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def inc_attempt(self, row: EmailVerificationModel):
        row.attempts += 1

    async def consume_verification(self, row: EmailVerificationModel):
        row.consumed_at = now_utc()

    async def create_refresh_session(
        self, session_id: uuid.UUID, user_id: uuid.UUID, refresh_hash: str, csrf_hash: str,
        expires_at, user_agent: str | None, ip: str | None, rotated_from: uuid.UUID | None = None
    ):
        row = RefreshSessionModel(
            id=session_id,
            user_id=user_id,
            refresh_hash=refresh_hash,
            csrf_hash=csrf_hash,
            expires_at=expires_at,
            user_agent=user_agent,
            ip=ip,
            rotated_from=rotated_from,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def get_refresh_session(self, session_id: uuid.UUID) -> RefreshSessionModel | None:
        return await self.session.get(RefreshSessionModel, session_id)

    async def revoke_refresh_session(self, row: RefreshSessionModel):
        row.revoked_at = now_utc()

    async def revoke_all_user_sessions(self, user_id: uuid.UUID):
        await self.session.execute(
            update(RefreshSessionModel)
            .where(RefreshSessionModel.user_id == user_id, RefreshSessionModel.revoked_at.is_(None))
            .values(revoked_at=now_utc())
        )

    async def list_user_sessions(self, user_id: uuid.UUID):
        q = (
            select(RefreshSessionModel)
            .where(RefreshSessionModel.user_id == user_id)
            .order_by(RefreshSessionModel.created_at.desc())
        )
        return (await self.session.execute(q)).scalars().all()

    async def add_security_event(self, event_type: str, user_id: uuid.UUID | None, ip: str | None, ua: str | None, meta: dict | None = None):
        row = SecurityEventModel(
            event_type=event_type,
            user_id=user_id,
            ip=ip,
            user_agent=ua,
            meta=meta or {},
        )
        self.session.add(row)
        await self.session.flush()
        return row
