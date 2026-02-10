from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.modules.auth.deps import get_current_user
from app.modules.submissions.api.schemas import SubmissionCreate, SubmissionResultOut
from app.modules.submissions.application.service import SubmissionService


router = APIRouter(tags=["submissions"])


@router.post(
    "/submissions",
    response_model=SubmissionResultOut,
    status_code=status.HTTP_201_CREATED,
)
async def submit_answer(
    body: SubmissionCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """
    Submit an answer for a problem.

    - Works without auth; `user_id` is optional for now.
    - Grading is deterministic for:
      - single_choice / multiple_choice (by correct options),
      - numeric (with tolerance),
      - short_text (by text or regex pattern).
    - Other types fall back to `needs_review`.
    """
    svc = SubmissionService(session)
    return await svc.submit(current_user.id, body)

