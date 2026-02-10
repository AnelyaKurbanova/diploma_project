from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.data.db.session import get_session
from app.modules.auth.deps import require_roles
from app.modules.users.api.schemas import AdminSetRoleIn, AdminUserOut
from app.modules.users.data.models import UserRole
from app.modules.users.data.repo import UserRepo


router = APIRouter(prefix="/admin", tags=["admin"])


def _to_admin_user_out(user) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        role=user.role,
        is_email_verified=user.is_email_verified,
        is_active=user.is_active,
    )


@router.patch("/users/{user_id}/role", response_model=AdminUserOut)
async def set_user_role(
    user_id: uuid.UUID,
    body: AdminSetRoleIn,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.ADMIN)),
):
    """
    Change any user's role. Admin only.
    """
    repo = UserRepo(session)
    user = await repo.get_by_id(user_id)
    if not user:
        raise NotFound("User not found")

    user.role = body.role
    await session.flush()
    await session.refresh(user)
    await session.commit()

    return _to_admin_user_out(user)
