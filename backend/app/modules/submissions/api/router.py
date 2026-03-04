from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.settings import settings
from app.modules.activity.application.service import ActivityService
from app.modules.auth.deps import get_current_user
from app.modules.auth.infra.ratelimit import RateLimitService, InMemoryRateLimiter, RedisRateLimiter
from app.modules.submissions.api.schemas import (
    SubmissionCreate,
    SubmissionResultOut,
    SubmissionProgressOut,
    SubmissionProgressBatchOut,
)
from app.modules.submissions.application.service import SubmissionService


router = APIRouter(tags=["submissions"])

_SUBMISSION_RL: RateLimitService | None = None


def _get_submission_rate_limiter() -> RateLimitService:
    global _SUBMISSION_RL
    if _SUBMISSION_RL is None:
        if settings.REDIS_URL:
            from redis.asyncio import from_url as redis_from_url
            _SUBMISSION_RL = RateLimitService(
                RedisRateLimiter(redis_from_url(settings.REDIS_URL, decode_responses=True)),
            )
        else:
            _SUBMISSION_RL = RateLimitService(InMemoryRateLimiter())
    return _SUBMISSION_RL


@router.post(
    "/submissions",
    response_model=SubmissionResultOut,
    status_code=status.HTTP_201_CREATED,
)
async def submit_answer(
    body: SubmissionCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    rl = _get_submission_rate_limiter()
    await rl.enforce(
        key=f"submissions:user:{current_user.id}",
        limit=settings.RL_SUBMISSIONS_PER_USER_PER_MINUTE,
        window_seconds=60,
        message="Слишком много отправок решений. Подождите минуту.",
    )
    svc = SubmissionService(session)
    result = await svc.submit(current_user.id, body)
    
    activity = ActivityService(session)
    client = request.client
    await activity.log(
        event_type="problem_submitted",
        user_id=current_user.id if current_user else None,
        path=str(request.url.path),
        ip=client.host if client else None,
        user_agent=request.headers.get("user-agent"),
        meta={
            "problem_id": str(body.problem_id),
            "submission_id": str(result.submission_id),
            "status": result.status.value,
            "is_correct": result.is_correct,
            "score": result.score,
        },
    )

    if result.status.value == "graded" and result.is_correct:
        await activity.log(
            event_type="problem_solved",
            user_id=current_user.id if current_user else None,
            path=str(request.url.path),
            ip=client.host if client else None,
            user_agent=request.headers.get("user-agent"),
            meta={
                "problem_id": str(body.problem_id),
                "submission_id": str(result.submission_id),
                "score": result.score,
            },
        )

    return result


@router.get(
    "/submissions/last/{problem_id}",
    response_model=SubmissionProgressOut,
)
async def get_last_submission(
    problem_id: str,
    assessment_id: uuid.UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = SubmissionService(session)
    progress = await svc.get_last_progress(
        current_user.id,
        uuid.UUID(problem_id),
        assessment_id,
    )
    return progress


@router.get(
    "/submissions/last",
    response_model=SubmissionProgressBatchOut,
)
async def get_last_submissions_batch(
    problem_ids: str = Query(..., alias="problem_ids", description="Comma-separated problem UUIDs"),
    assessment_id: uuid.UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    raw = [s.strip() for s in problem_ids.split(",") if s.strip()]
    ids: list[uuid.UUID] = []
    for s in raw[:100]:
        try:
            ids.append(uuid.UUID(s))
        except ValueError:
            continue
    svc = SubmissionService(session)
    items = await svc.get_progress_batch(current_user.id, ids, assessment_id)
    return SubmissionProgressBatchOut(items=items)
