from __future__ import annotations

import uuid

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Unauthorized, Forbidden
from app.core.i18n import tr
from app.data.db.session import get_session
from app.modules.auth.security.tokens import decode_token
from app.modules.users.data.models import UserModel, UserRole


bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    payload = decode_token(creds.credentials)
    if payload.get("type") != "access":
        raise Unauthorized(tr("invalid_access_token"))
    sub = payload.get("sub")
    if not sub:
        raise Unauthorized(tr("invalid_access_token"))

    user = await session.get(UserModel, uuid.UUID(sub))
    if not user or not user.is_active:
        raise Unauthorized(tr("user_not_found"))
    return user


def require_roles(*allowed_roles: UserRole):
    async def dependency(user=Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise Forbidden(tr("insufficient_permissions"))
        return user

    return dependency


get_current_active_user = get_current_user
