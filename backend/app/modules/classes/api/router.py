from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.modules.auth.deps import get_current_user, require_roles
from app.modules.classes.api.schemas import (
    ClassAssessmentCreateIn,
    ClassAssessmentDetailOut,
    ClassAssessmentItemOut,
    ClassAssessmentOut,
    ClassDetailOut,
    ClassStatsOut,
    ClassStudentOut,
    JoinClassIn,
    StudentAssessmentOut,
    StudentAssessmentDetailOut,
    StudentAssessmentItemOut,
    TeacherAssessmentProgressOut,
    TeacherAssessmentStudentProgressOut,
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


def _to_assessment_out(row, *, items_count: int, total_points: int) -> ClassAssessmentOut:
    return ClassAssessmentOut(
        id=row.id,
        class_id=row.class_id,
        title=row.title,
        description=row.description,
        due_at=row.due_at,
        time_limit_min=row.time_limit_min,
        is_published=row.is_published,
        created_at=row.created_at,
        items_count=items_count,
        total_points=total_points,
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


@router.get("/{class_id:uuid}", response_model=ClassDetailOut)
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


@router.post(
    "/{class_id:uuid}/assessments",
    response_model=ClassAssessmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_assessment(
    class_id: uuid.UUID,
    body: ClassAssessmentCreateIn,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.TEACHER)),
):
    svc = ClassService(session)
    row = await svc.create_assessment_for_teacher(
        current_user,
        class_id=class_id,
        title=body.title,
        description=body.description,
        due_at=body.due_at,
        time_limit_min=body.time_limit_min,
        items=[(item.problem_id, item.points) for item in body.items],
    )
    total_points = sum(item.points for item in body.items)
    return _to_assessment_out(
        row,
        items_count=len(body.items),
        total_points=total_points,
    )


@router.get(
    "/{class_id:uuid}/assessments",
    response_model=list[ClassAssessmentOut],
)
async def list_assessments(
    class_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.TEACHER)),
):
    svc = ClassService(session)
    rows = await svc.list_assessments_for_teacher(current_user, class_id=class_id)

    out: list[ClassAssessmentOut] = []
    for row in rows:
        items = await ClassRepo(session).list_assessment_items(row.id)
        out.append(
            _to_assessment_out(
                row,
                items_count=len(items),
                total_points=sum(item.points for item in items),
            )
        )
    return out


@router.get(
    "/{class_id:uuid}/assessments/{assessment_id:uuid}",
    response_model=ClassAssessmentDetailOut,
)
async def get_assessment_detail(
    class_id: uuid.UUID,
    assessment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.TEACHER)),
):
    svc = ClassService(session)
    assessment, items, problem_titles = await svc.get_assessment_detail_for_teacher(
        current_user,
        class_id=class_id,
        assessment_id=assessment_id,
    )
    total_points = sum(item.points for item in items)
    return ClassAssessmentDetailOut(
        **_to_assessment_out(
            assessment,
            items_count=len(items),
            total_points=total_points,
        ).model_dump(),
        items=[
            ClassAssessmentItemOut(
                id=item.id,
                problem_id=item.problem_id,
                problem_title=problem_titles.get(item.problem_id),
                order_no=item.order_no,
                points=item.points,
            )
            for item in items
        ],
    )


@router.get(
    "/{class_id:uuid}/assessments/{assessment_id:uuid}/progress",
    response_model=TeacherAssessmentProgressOut,
)
async def get_assessment_progress(
    class_id: uuid.UUID,
    assessment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.TEACHER)),
):
    svc = ClassService(session)
    data = await svc.get_assessment_progress_for_teacher(
        current_user,
        class_id=class_id,
        assessment_id=assessment_id,
    )
    return TeacherAssessmentProgressOut(
        **{k: v for k, v in data.items() if k != "students"},
        students=[TeacherAssessmentStudentProgressOut(**row) for row in data["students"]],
    )


@router.delete(
    "/{class_id:uuid}",
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
    "/{class_id:uuid}/students/{student_id:uuid}",
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


@router.post("/me/join", response_model=StudentClassOut)
async def join_class(
    body: JoinClassIn,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = ClassService(session)
    cls = await svc.join_by_code(current_user, body.join_code)

    repo = ClassRepo(session)
    links = await repo.list_students(cls.id)
    link = next((l for l in links if l.student_id == current_user.id), None)

    teacher = await session.get(UserModel, cls.teacher_id)
    teacher_profiles = UserProfileRepo(session)
    teacher_profile = await teacher_profiles.get_by_user_id(cls.teacher_id)
    teacher_name = (
        (teacher_profile.full_name if teacher_profile else None)
        or (teacher.email if teacher else None)
    )

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


@router.get("/me/assessments", response_model=list[StudentAssessmentOut])
async def list_my_assessments_student(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = ClassService(session)
    rows = await svc.list_assessments_for_student(current_user)
    return [StudentAssessmentOut(**row) for row in rows]


@router.get(
    "/me/assessments/{assessment_id:uuid}",
    response_model=StudentAssessmentDetailOut,
)
async def get_my_assessment_detail_student(
    assessment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = ClassService(session)
    row = await svc.get_assessment_detail_for_student(
        current_user,
        assessment_id=assessment_id,
    )
    return StudentAssessmentDetailOut(
        **{k: v for k, v in row.items() if k != "items"},
        items=[StudentAssessmentItemOut(**item) for item in row["items"]],
    )
