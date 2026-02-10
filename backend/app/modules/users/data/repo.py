from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.data.models import UserModel, UserProfileModel, UserRole


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
