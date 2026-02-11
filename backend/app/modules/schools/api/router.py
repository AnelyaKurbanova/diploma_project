from __future__ import annotations

import secrets
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.core.security import hash_teacher_code
from app.data.db.session import get_session
from app.modules.auth.deps import require_roles
from app.modules.schools.api.schemas import SchoolOut, SchoolCreateIn, SchoolWithCodeOut
from app.modules.schools.data.repo import SchoolRepo
from app.modules.users.data.models import UserRole


router = APIRouter(prefix="/schools", tags=["schools"])


def _generate_teacher_code(length: int = 12) -> str:
    """Generate a human-friendly random teacher code.

    Uses a Base32-like alphabet without ambiguous characters (O, I, 0, 1).
    """
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.get("", response_model=list[SchoolOut])
async def list_schools(
    session: AsyncSession = Depends(get_session),
):
    """List all schools for onboarding dropdown. Does not expose teacher_code or hash."""
    repo = SchoolRepo(session)
    schools = await repo.list_all()
    return [SchoolOut(id=s.id, name=s.name) for s in schools]


@router.get("/admin", response_model=list[SchoolOut])
async def list_schools_admin(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.MODERATOR)),
):
    """Admin-only list of schools. Same shape as public list but behind auth.

    We intentionally do NOT expose teacher codes here, only ids and names.
    Admin can generate a new code when needed.
    """
    repo = SchoolRepo(session)
    schools = await repo.list_all()
    return [SchoolOut(id=s.id, name=s.name) for s in schools]


@router.post("", response_model=SchoolWithCodeOut, status_code=status.HTTP_201_CREATED)
async def create_school(
    body: SchoolCreateIn,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.MODERATOR)),
):
    """Create a new school and generate a teacher code (admin/mod only).

    Returns the plain teacher_code once so it can be securely shared with teachers.
    """
    repo = SchoolRepo(session)

    code = _generate_teacher_code()
    row = await repo.create(name=body.name, teacher_code_hash=hash_teacher_code(code))

    await session.commit()
    await session.refresh(row)

    return SchoolWithCodeOut(id=row.id, name=row.name, teacher_code=code)


@router.post("/{school_id}/regenerate", response_model=SchoolWithCodeOut)
async def regenerate_school_code(
    school_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.MODERATOR)),
):
    """Generate a new teacher code for a school (admin/mod only).

    Old code becomes invalid. The new plain code is returned once.
    """
    repo = SchoolRepo(session)
    row = await repo.get_by_id(school_id)
    if not row:
        raise NotFound("Школа не найдена")

    code = _generate_teacher_code()
    row.teacher_code_hash = hash_teacher_code(code)

    await session.commit()
    await session.refresh(row)

    return SchoolWithCodeOut(id=row.id, name=row.name, teacher_code=code)
