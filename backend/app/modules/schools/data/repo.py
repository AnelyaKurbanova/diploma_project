from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.schools.data.models import SchoolModel


class SchoolRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, school_id: uuid.UUID) -> SchoolModel | None:
        return await self.session.get(SchoolModel, school_id)

    async def list_all(self) -> list[SchoolModel]:
        q = select(SchoolModel).order_by(SchoolModel.name)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def create(self, name: str, teacher_code_hash: str) -> SchoolModel:
        row = SchoolModel(name=name, teacher_code_hash=teacher_code_hash)
        self.session.add(row)
        await self.session.flush()
        return row

