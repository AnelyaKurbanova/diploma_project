from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.modules.auth.deps import get_current_user, require_roles
from app.modules.classes.api.schemas import (
    ClassDetailOut,
    ClassStatsOut,
    ClassStudentOut,
    JoinClassIn,
    StudentClassOut,
    TeacherClassOut,
)
from app.modules.classes.application.service import ClassService
from app.modules.classes.data.repo import ClassRepo
from app.modules.users.data.models import UserRole, UserModel
from app.modules.users.data.repo import UserProfileRepo


router = APIRouter(prefix="/classes", tags=["classes"])


def _to_teacher_class_out(row, *, students_count: int) -> TeacherClassOut:
    return TeacherClassOut(
        id=row.id,
        name=row.name,
        join_code=row.join_code,
        created_at=row.created_at,
        students_count=students_count,
    )


@router.post(
    "",
    response_model=TeacherClassOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_class(
    body: dict,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.TEACHER)),
):
    name = (body.get("name") or "").strip()
    svc = ClassService(session)
    row = await svc.create_class(current_user, name)
    repo = ClassRepo(session)
    students_count = await repo.count_students(row.id)
    return _to_teacher_class_out(row, students_count=students_count)


@router.get("", response_model=list[TeacherClassOut])
async def list_my_classes(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.TEACHER)),
):
    svc = ClassService(session)
    repo = ClassRepo(session)
    rows = await svc.list_my_classes(current_user)
    result: list[TeacherClassOut] = []
    for row in rows:
        students_count = await repo.count_students(row.id)
        result.append(_to_teacher_class_out(row, students_count=students_count))
    return result


@router.get("/{class_id}", response_model=ClassDetailOut)
async def get_class_detail(
    class_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.TEACHER)),
):
    svc = ClassService(session)
    repo = ClassRepo(session)
    user_profiles = UserProfileRepo(session)

    cls = await svc.get_class_for_teacher(current_user, class_id)
    student_links = await repo.list_students(cls.id)
    stats_raw = await svc.get_class_stats_for_teacher(current_user, cls.id)

    per_student_progress: dict[uuid.UUID, int] = stats_raw.get(
        "per_student_progress", {}
    )

    students_out: list[ClassStudentOut] = []
    for link in student_links:
        user = await session.get(UserModel, link.student_id)
        profile = await user_profiles.get_by_user_id(link.student_id)
        full_name = profile.full_name if profile else None
        overall_progress = per_student_progress.get(link.student_id)

        students_out.append(
            ClassStudentOut(
                id=link.student_id,
                email=user.email if user else "",
                full_name=full_name,
                joined_at=link.created_at,
                overall_progress=overall_progress,
            )
        )

    stats = ClassStatsOut(
        total_students=stats_raw["total_students"],
        avg_overall_progress=stats_raw["avg_overall_progress"],
    )

    return ClassDetailOut(
        id=cls.id,
        name=cls.name,
        join_code=cls.join_code,
        created_at=cls.created_at,
        students=students_out,
        stats=stats,
    )


@router.delete(
    "/{class_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_class(
    class_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.TEACHER)),
):
    svc = ClassService(session)
    await svc.delete_class(current_user, class_id)
    return None


@router.delete(
    "/{class_id}/students/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_student(
    class_id: uuid.UUID,
    student_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.TEACHER)),
):
    svc = ClassService(session)
    await svc.remove_student_from_class(
        current_user,
        class_id=class_id,
        student_id=student_id,
    )
    return None


# ------------------------- Student endpoints ------------------------- #


@router.post("/me/join", response_model=StudentClassOut)
async def join_class(
    body: JoinClassIn,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = ClassService(session)
    cls = await svc.join_by_code(current_user, body.join_code)

    # Найдём запись ClassStudentModel для определения joined_at
    repo = ClassRepo(session)
    links = await repo.list_students(cls.id)
    link = next((l for l in links if l.student_id == current_user.id), None)

    # teacher profile/name
    teacher = await session.get(UserModel, cls.teacher_id)
    teacher_profiles = UserProfileRepo(session)
    teacher_profile = await teacher_profiles.get_by_user_id(cls.teacher_id)
    teacher_name = (
        (teacher_profile.full_name if teacher_profile else None)
        or (teacher.email if teacher else None)
    )

    # Простейшая статистика для ученика в рамках класса — берём общий прогресс
    stats = await ClassService(session).get_class_stats_for_teacher(
        current_user=teacher,  # type: ignore[arg-type]
        class_id=cls.id,
    )
    per_student = stats.get("per_student_progress", {})
    overall_progress = per_student.get(current_user.id)

    return StudentClassOut(
        id=cls.id,
        name=cls.name,
        teacher_name=teacher_name,
        joined_at=link.created_at if link else cls.created_at,
        overall_progress=overall_progress,
    )


@router.get("/me", response_model=list[StudentClassOut])
async def list_my_classes_student(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = ClassService(session)
    repo = ClassRepo(session)
    rows = await svc.list_my_classes_student(current_user)

    teacher_profiles = UserProfileRepo(session)
    result: list[StudentClassOut] = []

    for cls in rows:
        # Находим запись с joined_at
        links = await repo.list_students(cls.id)
        link = next((l for l in links if l.student_id == current_user.id), None)

        teacher = await session.get(UserModel, cls.teacher_id)
        teacher_profile = await teacher_profiles.get_by_user_id(cls.teacher_id)
        teacher_name = (
            (teacher_profile.full_name if teacher_profile else None)
            or (teacher.email if teacher else None)
        )

        result.append(
            StudentClassOut(
                id=cls.id,
                name=cls.name,
                teacher_name=teacher_name,
                joined_at=link.created_at if link else cls.created_at,
                overall_progress=None,
            )
        )

    return result

