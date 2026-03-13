from __future__ import annotations

import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.projects.data.repo import ProjectRepo
from app.modules.projects.api.schemas import ProjectCreate, ProjectUpdate
from app.modules.projects.data.models import ProjectModel

class ProjectService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ProjectRepo(session)

    async def create(self, data: ProjectCreate) -> ProjectModel:
        async with self.session.begin():
            return await self.repo.create(name=data.name, description=data.description)

    async def get(self, project_id: uuid.UUID) -> ProjectModel:
        return await self.repo.get(project_id)

    async def list(self, limit: int, offset: int) -> list[ProjectModel]:
        return await self.repo.list(limit=limit, offset=offset)

    async def update(self, project_id: uuid.UUID, data: ProjectUpdate) -> ProjectModel:
        async with self.session.begin():
            return await self.repo.update(project_id, name=data.name, description=data.description)

    async def delete(self, project_id: uuid.UUID) -> None:
        async with self.session.begin():
            await self.repo.delete(project_id)
