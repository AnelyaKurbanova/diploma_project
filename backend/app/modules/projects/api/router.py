from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.modules.projects.api.schemas import ProjectCreate, ProjectUpdate, ProjectOut
from app.modules.projects.application.service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])

def to_out(row) -> ProjectOut:
    return ProjectOut(
        id=row.id,
        name=row.name,
        description=row.description,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )

@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    session: AsyncSession = Depends(get_session),
):
    svc = ProjectService(session)
    row = await svc.create(body)
    return to_out(row)

@router.get("", response_model=list[ProjectOut])
async def list_projects(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    svc = ProjectService(session)
    rows = await svc.list(limit=limit, offset=offset)
    return [to_out(r) for r in rows]

@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    svc = ProjectService(session)
    row = await svc.get(project_id)
    return to_out(row)

@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    session: AsyncSession = Depends(get_session),
):
    svc = ProjectService(session)
    row = await svc.update(project_id, body)
    return to_out(row)

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    svc = ProjectService(session)
    await svc.delete(project_id)
    return None
