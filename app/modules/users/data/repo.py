from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.users.data.models import UserModel


class UserRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_email(self, email: str) -> UserModel | None:
        email = email.lower().strip()
        q = select(UserModel).where(UserModel.email == email)
        return (await self.session.execute(q)).scalars().first()

    async def create(self, email: str) -> UserModel:
        row = UserModel(email=email.lower().strip())
        self.session.add(row)
        await self.session.flush()
        return row
