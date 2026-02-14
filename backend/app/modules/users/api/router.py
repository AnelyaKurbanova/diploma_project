from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequest, NotFound
from app.core.security import verify_teacher_code
from app.data.db.session import get_session
from app.modules.auth.deps import get_current_user
from app.modules.classes.data.models import ClassModel, ClassStudentModel
from app.modules.schools.data.repo import SchoolRepo
from app.modules.lessons.data.models import LessonProgressModel
from app.modules.submissions.data.models import SubmissionModel
from app.modules.users.api.schemas import (
    ActivityDayOut,
    FriendOut,
    OnboardingIn,
    SocialOut,
    UserProfileOut,
    UserProfileUpdate,
)
from app.modules.users.data.models import UserModel, UserProfileModel, UserRole
from app.modules.users.data.repo import UserProfileRepo


router = APIRouter(prefix="/me", tags=["users"])


def _to_profile_out(current_user, profile) -> UserProfileOut:
    return UserProfileOut(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        is_email_verified=current_user.is_email_verified,
        is_active=current_user.is_active,
        full_name=profile.full_name,
        school_id=profile.school_id,
        school=profile.school,
        city=profile.city,
        grade_level=profile.grade_level,
        preferred_language=profile.preferred_language,
        timezone=profile.timezone,
        primary_goal=profile.primary_goal,
        interested_subjects=profile.interested_subjects or None,
        intro_difficulties=profile.intro_difficulties,
        intro_notes=profile.intro_notes,
        onboarding_completed_at=profile.onboarding_completed_at,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get("/profile", response_model=UserProfileOut)
async def get_my_profile(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """
    Return merged user + profile information for the current user.

    If profile does not exist yet, this means onboarding has not been completed.
    """
    profiles = UserProfileRepo(session)
    profile = await profiles.get_by_user_id(current_user.id)
    if not profile:
        # Onboarding is required before profile can be returned
        raise NotFound("Profile not initialized")

    return _to_profile_out(current_user, profile)


@router.get("/social", response_model=SocialOut)
async def get_my_social(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    # -------- Friends from real class relations --------
    # For student:
    # - classmates from enrolled classes (excluding self)
    # - teachers of enrolled classes
    # For teacher:
    # - students from teacher's own classes
    friend_ids: set = set()

    if current_user.role == UserRole.STUDENT:
        class_ids_stmt = select(ClassStudentModel.class_id).where(
            ClassStudentModel.student_id == current_user.id,
        )
        class_ids = (await session.execute(class_ids_stmt)).scalars().all()
        if class_ids:
            classmates_stmt = select(ClassStudentModel.student_id).where(
                ClassStudentModel.class_id.in_(class_ids),
                ClassStudentModel.student_id != current_user.id,
            )
            teacher_ids_stmt = select(ClassModel.teacher_id).where(
                ClassModel.id.in_(class_ids),
                ClassModel.teacher_id != current_user.id,
            )
            friend_ids.update((await session.execute(classmates_stmt)).scalars().all())
            friend_ids.update((await session.execute(teacher_ids_stmt)).scalars().all())
    elif current_user.role == UserRole.TEACHER:
        class_ids_stmt = select(ClassModel.id).where(ClassModel.teacher_id == current_user.id)
        class_ids = (await session.execute(class_ids_stmt)).scalars().all()
        if class_ids:
            students_stmt = select(ClassStudentModel.student_id).where(
                ClassStudentModel.class_id.in_(class_ids),
            )
            friend_ids.update((await session.execute(students_stmt)).scalars().all())

    friends: list[FriendOut] = []
    if friend_ids:
        friend_rows_stmt = (
            select(UserModel, UserProfileModel)
            .outerjoin(UserProfileModel, UserProfileModel.user_id == UserModel.id)
            .where(UserModel.id.in_(list(friend_ids)))
            .order_by(UserModel.created_at.desc())
            .limit(20)
        )
        rows = (await session.execute(friend_rows_stmt)).all()
        for user_row, profile_row in rows:
            display_name = (
                profile_row.full_name
                if profile_row and profile_row.full_name
                else user_row.email.split("@")[0]
            )
            friends.append(
                FriendOut(
                    id=user_row.id,
                    full_name=display_name,
                    role=user_row.role,
                )
            )

    # -------- Activity by day from real learning actions --------
    # We aggregate submissions + completed lessons per day.
    sub_q = (
        select(func.date(SubmissionModel.submitted_at).label("date"))
        .where(SubmissionModel.user_id == current_user.id)
    )
    lesson_q = (
        select(func.date(LessonProgressModel.completed_at).label("date"))
        .where(
            LessonProgressModel.user_id == current_user.id,
            LessonProgressModel.completed.is_(True),
        )
    )
    union_q = union_all(sub_q, lesson_q).subquery()
    activity_stmt = (
        select(
            union_q.c.date.label("date"),
            func.count().label("count"),
        )
        .group_by(union_q.c.date)
        .order_by(union_q.c.date.desc())
        .limit(120)
    )
    activity_rows = (await session.execute(activity_stmt)).all()
    activity = [
        ActivityDayOut(date=row.date.isoformat(), count=int(row.count))
        for row in activity_rows
        if row.date is not None
    ]

    return SocialOut(friends=friends, activity=activity)


@router.patch("/profile", response_model=UserProfileOut)
async def update_my_profile(
    body: UserProfileUpdate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """
    Update profile fields for the current user.

    Requires that onboarding has already created a profile.
    """
    profiles = UserProfileRepo(session)
    profile = await profiles.get_by_user_id(current_user.id)
    if not profile:
        raise NotFound("Profile not initialized")

    if body.full_name is not None:
        profile.full_name = body.full_name
    if body.school is not None:
        profile.school = body.school
    if body.city is not None:
        profile.city = body.city
    if body.grade_level is not None:
        profile.grade_level = body.grade_level
    if body.preferred_language is not None:
        profile.preferred_language = body.preferred_language
    if body.timezone is not None:
        profile.timezone = body.timezone

    await session.flush()
    # Ensure all server-side defaults (e.g. updated_at) are loaded in async context
    await session.refresh(profile)
    await session.commit()

    return _to_profile_out(current_user, profile)


@router.post("/onboarding", response_model=UserProfileOut)
async def complete_onboarding(
    body: OnboardingIn,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """
    Create or update the profile for the current user based on onboarding answers.
    For teachers: school_id and teacher_code are required; code is verified against school.
    """
    profiles = UserProfileRepo(session)
    profile = await profiles.get_by_user_id(current_user.id)
    now = datetime.now(timezone.utc)

    if not profile:
        profile = await profiles.create_default_for_user(current_user.id)

    if body.is_teacher:
        school_repo = SchoolRepo(session)
        school = await school_repo.get_by_id(body.school_id)  # type: ignore[arg-type]
        if not school:
            raise BadRequest("Школа не найдена")
        if not verify_teacher_code((body.teacher_code or "").strip(), school.teacher_code_hash):
            raise BadRequest("Неверный код учителя")
        current_user.role = UserRole.TEACHER
        profile.school_id = body.school_id
        profile.school = school.name
        profile.grade_level = None
        profile.primary_goal = None
        profile.interested_subjects = None
        profile.intro_difficulties = body.difficulties
        profile.intro_notes = body.notes
    else:
        current_user.role = UserRole.STUDENT
        profile.grade_level = body.grade_level
        profile.primary_goal = body.primary_goal
        profile.interested_subjects = body.interested_subjects
        profile.intro_difficulties = body.difficulties
        profile.intro_notes = body.notes

    # Default full_name from email (part before @) when not provided
    if body.full_name and body.full_name.strip():
        profile.full_name = body.full_name.strip()
    else:
        profile.full_name = current_user.email.split("@")[0] if current_user.email else None

    profile.onboarding_completed_at = now

    await session.flush()
    await session.refresh(profile)
    await session.commit()

    return _to_profile_out(current_user, profile)
