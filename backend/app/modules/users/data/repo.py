from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.data.models import (
    UserFriendModel,
    UserFriendRequestModel,
    UserModel,
    UserProfileModel,
    UserRole,
)


class UserRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: uuid.UUID) -> UserModel | None:
        return await self.session.get(UserModel, user_id)

    async def get_by_email(self, email: str) -> UserModel | None:
        email = email.lower().strip()
        q = select(UserModel).where(UserModel.email == email)
        return (await self.session.execute(q)).scalars().first()

    async def create(self, email: str) -> UserModel:
        row = UserModel(
            email=email.lower().strip(),
            role=UserRole.STUDENT,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def list_users(
        self,
        *,
        role: UserRole | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[UserModel], int]:
        stmt: Select = select(UserModel).order_by(UserModel.created_at.desc())
        count_stmt = select(func.count()).select_from(UserModel)

        if role is not None:
            stmt = stmt.where(UserModel.role == role)
            count_stmt = count_stmt.where(UserModel.role == role)
        if search:
            pattern = f"%{search.lower()}%"
            stmt = stmt.where(UserModel.email.ilike(pattern))
            count_stmt = count_stmt.where(UserModel.email.ilike(pattern))

        total = (await self.session.execute(count_stmt)).scalar_one()
        rows: Sequence[UserModel] = (
            await self.session.execute(stmt.offset(offset).limit(limit))
        ).scalars().all()
        return list(rows), total


class UserProfileRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_user_id(self, user_id) -> UserProfileModel | None:
        return await self.session.get(UserProfileModel, user_id)

    async def create_default_for_user(self, user_id) -> UserProfileModel:
        row = UserProfileModel(user_id=user_id)
        self.session.add(row)
        await self.session.flush()
        return row


class UserFriendRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    @staticmethod
    def _normalize_pair(user_id: uuid.UUID, friend_id: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
        return (user_id, friend_id) if str(user_id) < str(friend_id) else (friend_id, user_id)

    async def are_friends(self, user_id: uuid.UUID, friend_id: uuid.UUID) -> bool:
        a, b = self._normalize_pair(user_id, friend_id)
        stmt = select(UserFriendModel).where(
            UserFriendModel.user_id == a,
            UserFriendModel.friend_id == b,
        )
        row = (await self.session.execute(stmt)).scalar_one_or_none()
        return row is not None

    async def create_friendship(self, user_id: uuid.UUID, friend_id: uuid.UUID) -> bool:
        a, b = self._normalize_pair(user_id, friend_id)
        if await self.are_friends(a, b):
            return False
        self.session.add(UserFriendModel(user_id=a, friend_id=b))
        await self.session.flush()
        return True

    async def delete_friendship(self, user_id: uuid.UUID, friend_id: uuid.UUID) -> bool:
        a, b = self._normalize_pair(user_id, friend_id)
        stmt = select(UserFriendModel).where(
            UserFriendModel.user_id == a,
            UserFriendModel.friend_id == b,
        )
        row = (await self.session.execute(stmt)).scalar_one_or_none()
        if row is None:
            return False
        await self.session.delete(row)
        await self.session.flush()
        return True

    async def list_friend_ids(self, user_id: uuid.UUID) -> list[uuid.UUID]:
        stmt = select(UserFriendModel).where(
            or_(
                UserFriendModel.user_id == user_id,
                UserFriendModel.friend_id == user_id,
            )
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        ids: list[uuid.UUID] = []
        for row in rows:
            ids.append(row.friend_id if row.user_id == user_id else row.user_id)
        return ids

    async def count_friends(self, user_id: uuid.UUID) -> int:
        stmt = select(func.count()).select_from(UserFriendModel).where(
            or_(
                UserFriendModel.user_id == user_id,
                UserFriendModel.friend_id == user_id,
            )
        )
        return int((await self.session.execute(stmt)).scalar_one())


class UserFriendRequestRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_between(
        self,
        requester_id: uuid.UUID,
        target_id: uuid.UUID,
    ) -> UserFriendRequestModel | None:
        stmt = select(UserFriendRequestModel).where(
            UserFriendRequestModel.requester_id == requester_id,
            UserFriendRequestModel.target_id == target_id,
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def create_request(self, requester_id: uuid.UUID, target_id: uuid.UUID) -> bool:
        existing = await self.get_between(requester_id, target_id)
        if existing is not None:
            return False
        self.session.add(
            UserFriendRequestModel(
                requester_id=requester_id,
                target_id=target_id,
            )
        )
        await self.session.flush()
        return True

    async def delete_request(self, requester_id: uuid.UUID, target_id: uuid.UUID) -> bool:
        existing = await self.get_between(requester_id, target_id)
        if existing is None:
            return False
        await self.session.delete(existing)
        await self.session.flush()
        return True

    async def list_incoming(self, target_id: uuid.UUID) -> list[UserFriendRequestModel]:
        stmt = (
            select(UserFriendRequestModel)
            .where(UserFriendRequestModel.target_id == target_id)
            .order_by(UserFriendRequestModel.created_at.desc())
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def list_outgoing(self, requester_id: uuid.UUID) -> list[UserFriendRequestModel]:
        stmt = (
            select(UserFriendRequestModel)
            .where(UserFriendRequestModel.requester_id == requester_id)
            .order_by(UserFriendRequestModel.created_at.desc())
        )
        return list((await self.session.execute(stmt)).scalars().all())
