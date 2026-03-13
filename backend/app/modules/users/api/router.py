from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy import func, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequest, NotFound
from app.core.i18n import tr
from app.core.security import verify_teacher_code
from app.data.db.session import get_session
from app.modules.auth.deps import get_current_user
from app.modules.schools.data.repo import SchoolRepo
from app.modules.lessons.data.models import LessonProgressModel
from app.modules.submissions.data.models import SubmissionModel
from app.modules.dashboard.application.service import DashboardService
from app.modules.users.api.schemas import (
    ActivityDayOut,
    FriendAddIn,
    FriendOut,
    FriendRequestOut,
    OnboardingIn,
    PublicStatsOut,
    PublicUserProfileOut,
    SocialOut,
    UserProfileOut,
    UserProfileUpdate,
)
from app.modules.users.data.models import UserModel, UserProfileModel, UserRole
from app.modules.users.data.repo import UserFriendRepo, UserFriendRequestRepo, UserProfileRepo, UserRepo


router = APIRouter(prefix="/me", tags=["users"])


async def _load_activity_days(session: AsyncSession, user_id) -> list[ActivityDayOut]:
    sub_q = (
        select(func.date(SubmissionModel.submitted_at).label("date"))
        .where(SubmissionModel.user_id == user_id)
    )
    lesson_q = (
        select(func.date(LessonProgressModel.completed_at).label("date"))
        .where(
            LessonProgressModel.user_id == user_id,
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
    return [
        ActivityDayOut(date=row.date.isoformat(), count=int(row.count))
        for row in activity_rows
        if row.date is not None
    ]


async def _load_friends(
    session: AsyncSession,
    friend_repo: UserFriendRepo,
    user_id,
    *,
    limit: int = 20,
) -> list[FriendOut]:
    friend_ids = await friend_repo.list_friend_ids(user_id)
    if not friend_ids:
        return []
    friend_rows_stmt = (
        select(UserModel, UserProfileModel)
        .outerjoin(UserProfileModel, UserProfileModel.user_id == UserModel.id)
        .where(UserModel.id.in_(friend_ids))
        .order_by(UserModel.created_at.desc())
        .limit(limit)
    )
    rows = (await session.execute(friend_rows_stmt)).all()
    friends: list[FriendOut] = []
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
                avatar_url=profile_row.avatar_url if profile_row else None,
            )
        )
    return friends


async def _load_incoming_requests(
    session: AsyncSession,
    request_repo: UserFriendRequestRepo,
    user_id: uuid.UUID,
    *,
    limit: int = 20,
) -> list[FriendRequestOut]:
    incoming = await request_repo.list_incoming(user_id)
    incoming = incoming[:limit]
    if not incoming:
        return []

    requester_ids = [row.requester_id for row in incoming]
    users_stmt = (
        select(UserModel, UserProfileModel)
        .outerjoin(UserProfileModel, UserProfileModel.user_id == UserModel.id)
        .where(UserModel.id.in_(requester_ids))
    )
    rows = (await session.execute(users_stmt)).all()
    user_map: dict[uuid.UUID, tuple[UserModel, UserProfileModel | None]] = {
        u.id: (u, p) for u, p in rows
    }

    out: list[FriendRequestOut] = []
    for req in incoming:
        pair = user_map.get(req.requester_id)
        if not pair:
            continue
        req_user, req_profile = pair
        display_name = (
            req_profile.full_name
            if req_profile and req_profile.full_name
            else req_user.email.split("@")[0]
        )
        out.append(
            FriendRequestOut(
                requester_id=req.requester_id,
                requester_name=display_name,
                requester_role=req_user.role,
                created_at=req.created_at,
            )
        )
    return out


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
        avatar_url=profile.avatar_url,
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
    profiles = UserProfileRepo(session)
    profile = await profiles.get_by_user_id(current_user.id)
    if not profile:
        raise NotFound(tr("profile_not_initialized"))

    return _to_profile_out(current_user, profile)


@router.get("/social", response_model=SocialOut)
async def get_my_social(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    friend_repo = UserFriendRepo(session)
    request_repo = UserFriendRequestRepo(session)
    friends = await _load_friends(session, friend_repo, current_user.id, limit=20)
    activity = await _load_activity_days(session, current_user.id)
    incoming_requests = await _load_incoming_requests(
        session,
        request_repo,
        current_user.id,
        limit=20,
    )
    outgoing_requests = await request_repo.list_outgoing(current_user.id)
    outgoing_request_user_ids = [row.target_id for row in outgoing_requests]
    return SocialOut(
        friends=friends,
        activity=activity,
        incoming_requests=incoming_requests,
        outgoing_request_user_ids=outgoing_request_user_ids,
    )


@router.post("/friends")
async def add_friend(
    body: FriendAddIn,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    user_repo = UserRepo(session)
    friend_repo = UserFriendRepo(session)
    request_repo = UserFriendRequestRepo(session)

    target_user = None
    if body.friend_user_id is not None:
        target_user = await user_repo.get_by_id(body.friend_user_id)
    elif body.friend_email:
        target_user = await user_repo.get_by_email(body.friend_email)

    if target_user is None:
        raise NotFound("Пользователь не найден")
    if target_user.id == current_user.id:
        raise BadRequest("Нельзя добавить себя в друзья")
    if await friend_repo.are_friends(current_user.id, target_user.id):
        return {"status": "already_friends"}

    reverse_request = await request_repo.get_between(target_user.id, current_user.id)
    if reverse_request is not None:
        raise BadRequest("У вас уже есть входящая заявка от этого пользователя")

    created = await request_repo.create_request(current_user.id, target_user.id)
    await session.commit()

    if not created:
        return {"status": "already_requested"}
    return {"status": "request_sent"}


@router.post("/friends/requests/{requester_id}/accept")
async def accept_friend_request(
    requester_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    request_repo = UserFriendRequestRepo(session)
    friend_repo = UserFriendRepo(session)

    request_row = await request_repo.get_between(requester_id, current_user.id)
    if request_row is None:
        raise NotFound("Заявка в друзья не найдена")

    await request_repo.delete_request(requester_id, current_user.id)
    await friend_repo.create_friendship(current_user.id, requester_id)
    await session.commit()
    return {"ok": True}


@router.post("/friends/requests/{requester_id}/reject")
async def reject_friend_request(
    requester_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    request_repo = UserFriendRequestRepo(session)
    deleted = await request_repo.delete_request(requester_id, current_user.id)
    await session.commit()
    if not deleted:
        raise NotFound("Заявка в друзья не найдена")
    return {"ok": True}


@router.delete("/friends/requests/{target_id}")
async def cancel_friend_request(
    target_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    request_repo = UserFriendRequestRepo(session)
    deleted = await request_repo.delete_request(current_user.id, target_id)
    await session.commit()
    if not deleted:
        raise NotFound("Исходящая заявка не найдена")
    return {"ok": True}


@router.delete("/friends/{friend_id}")
async def remove_friend(
    friend_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    friend_repo = UserFriendRepo(session)
    await friend_repo.delete_friendship(current_user.id, friend_id)
    await session.commit()
    return {"ok": True}


@router.get("/users/{user_id}/profile", response_model=PublicUserProfileOut)
async def get_public_profile(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    user_repo = UserRepo(session)
    friend_repo = UserFriendRepo(session)
    profile_repo = UserProfileRepo(session)

    target_user = await user_repo.get_by_id(user_id)
    if target_user is None:
        raise NotFound("Пользователь не найден")
    target_profile = await profile_repo.get_by_user_id(target_user.id)

    full_name = (
        target_profile.full_name
        if target_profile and target_profile.full_name
        else target_user.email.split("@")[0]
    )
    is_friend = await friend_repo.are_friends(current_user.id, target_user.id)
    if is_friend:
        friendship_status = "friends"
    else:
        request_repo = UserFriendRequestRepo(session)
        if await request_repo.get_between(current_user.id, target_user.id):
            friendship_status = "outgoing_request"
        elif await request_repo.get_between(target_user.id, current_user.id):
            friendship_status = "incoming_request"
        else:
            friendship_status = "none"
    friends_count = await friend_repo.count_friends(target_user.id)
    activity = await _load_activity_days(session, target_user.id)
    friends = await _load_friends(session, friend_repo, target_user.id, limit=20)
    dashboard = await DashboardService(session).get_stats(target_user.id)

    return PublicUserProfileOut(
        id=target_user.id,
        full_name=full_name,
        role=target_user.role,
        city=target_profile.city if target_profile else None,
        avatar_url=target_profile.avatar_url if target_profile else None,
        grade_level=target_profile.grade_level if target_profile else None,
        created_at=target_user.created_at,
        is_friend=is_friend,
        friendship_status=friendship_status,
        friends_count=friends_count,
        stats=PublicStatsOut(
            overall_progress=dashboard.overall_progress,
            completed_lectures=dashboard.completed_lectures,
            total_lectures=dashboard.total_lectures,
            solved_tasks=dashboard.solved_tasks,
            total_tasks=dashboard.total_tasks,
            accuracy=dashboard.accuracy,
        ),
        activity=activity,
        friends=friends,
    )


@router.patch("/profile", response_model=UserProfileOut)
async def update_my_profile(
    body: UserProfileUpdate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    profiles = UserProfileRepo(session)
    profile = await profiles.get_by_user_id(current_user.id)
    if not profile:
        raise NotFound(tr("profile_not_initialized"))

    if body.full_name is not None:
        profile.full_name = body.full_name
    if body.school is not None:
        profile.school = body.school
    if body.city is not None:
        profile.city = body.city
    if body.avatar_url is not None:
        profile.avatar_url = body.avatar_url
    if body.grade_level is not None:
        profile.grade_level = body.grade_level
    if body.preferred_language is not None:
        profile.preferred_language = body.preferred_language
    if body.timezone is not None:
        profile.timezone = body.timezone

    await session.flush()   
    await session.refresh(profile)
    await session.commit()

    return _to_profile_out(current_user, profile)


@router.post("/profile/avatar")
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise BadRequest("Можно загрузить только изображение")

    data = await file.read()
    if not data:
        raise BadRequest("Файл пустой")
    if len(data) > 5 * 1024 * 1024:
        raise BadRequest("Максимальный размер файла: 5 MB")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        if content_type == "image/jpeg":
            ext = ".jpg"
        elif content_type == "image/png":
            ext = ".png"
        elif content_type == "image/webp":
            ext = ".webp"
        else:
            raise BadRequest("Поддерживаются только JPG, PNG, WEBP")

    avatar_dir = Path(__file__).resolve().parents[3] / "static" / "avatars"
    avatar_dir.mkdir(parents=True, exist_ok=True)

    file_name = f"{current_user.id}_{secrets.token_hex(8)}{ext}"
    save_path = avatar_dir / file_name
    save_path.write_bytes(data)

    avatar_url = str(request.url_for("static", path=f"avatars/{file_name}"))

    profiles = UserProfileRepo(session)
    profile = await profiles.get_by_user_id(current_user.id)
    if not profile:
        raise NotFound("Profile not initialized")

    profile.avatar_url = avatar_url
    await session.flush()
    await session.refresh(profile)
    await session.commit()

    return {"avatar_url": avatar_url}


@router.post("/onboarding", response_model=UserProfileOut)
async def complete_onboarding(
    body: OnboardingIn,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    profiles = UserProfileRepo(session)
    profile = await profiles.get_by_user_id(current_user.id)
    now = datetime.now(timezone.utc)

    if not profile:
        profile = await profiles.create_default_for_user(current_user.id)

    if body.is_teacher:
        school_repo = SchoolRepo(session)
        school = await school_repo.get_by_id(body.school_id)
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

    if body.full_name and body.full_name.strip():
        profile.full_name = body.full_name.strip()
    else:
        profile.full_name = current_user.email.split("@")[0] if current_user.email else None

    profile.onboarding_completed_at = now

    await session.flush()
    await session.refresh(profile)
    await session.commit()

    return _to_profile_out(current_user, profile)
