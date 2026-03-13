from __future__ import annotations

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.errors import Conflict, NotFound
from app.core.i18n import tr
from app.modules.projects.data.models import ProjectModel

class ProjectRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, name: str, description: str | None) -> ProjectModel:
        row = ProjectModel(name=name, description=description)
        self.session.add(row)
        try:
            await self.session.flush()
        except IntegrityError:
            raise Conflict(tr("project_name_exists"))
        return row

    async def get(self, project_id: uuid.UUID) -> ProjectModel:
        row = await self.session.get(ProjectModel, project_id)
        if not row:
            raise NotFound(tr("project_not_found"))
        return row

    async def list(self, limit: int, offset: int) -> list[ProjectModel]:
        q = (
            select(ProjectModel)
            .order_by(ProjectModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = (await self.session.execute(q)).scalars().all()
        return list(rows)

    async def update(
        self,
        project_id: uuid.UUID,
        name: str | None,
        description: str | None,
    ) -> ProjectModel:
        row = await self.get(project_id)
        if name is not None:
            row.name = name
        if description is not None:
            row.description = description
        try:
            await self.session.flush()
        except IntegrityError:
            raise Conflict(tr("project_name_exists"))
        return row

    async def delete(self, project_id: uuid.UUID) -> None:
        row = await self.get(project_id)
        await self.session.delete(row)
        await self.session.flush()
