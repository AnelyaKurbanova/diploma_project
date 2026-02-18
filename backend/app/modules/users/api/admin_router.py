from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.core.i18n import tr
from app.data.db.session import get_session
from app.modules.auth.deps import require_roles
from app.modules.users.api.schemas import (
    AdminSetRoleIn,
    AdminUserListOut,
    AdminUserOut,
    AdminUserUpdate,
)
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
        created_at=user.created_at,
    )


@router.get("/users", response_model=AdminUserListOut)
async def list_users(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    role: UserRole | None = Query(default=None),
    search: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.ADMIN)),
):
    repo = UserRepo(session)
    offset = (page - 1) * per_page
    users, total = await repo.list_users(
        role=role,
        search=search,
        offset=offset,
        limit=per_page,
    )
    return AdminUserListOut(
        items=[_to_admin_user_out(u) for u in users],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.patch("/users/{user_id}/role", response_model=AdminUserOut)
async def set_user_role(
    user_id: uuid.UUID,
    body: AdminSetRoleIn,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.ADMIN)),
):
    repo = UserRepo(session)
    user = await repo.get_by_id(user_id)
    if not user:
        raise NotFound(tr("user_not_found"))

    user.role = body.role
    await session.flush()
    await session.refresh(user)
    await session.commit()

    return _to_admin_user_out(user)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def update_user(
    user_id: uuid.UUID,
    body: AdminUserUpdate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.ADMIN)),
):
    repo = UserRepo(session)
    user = await repo.get_by_id(user_id)
    if not user:
        raise NotFound(tr("user_not_found"))

    if body.is_active is not None:
        user.is_active = body.is_active
    if body.role is not None:
        user.role = body.role

    await session.flush()
    await session.refresh(user)
    await session.commit()

    return _to_admin_user_out(user)
