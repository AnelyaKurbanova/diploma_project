from __future__ import annotations

import asyncio
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.data.db.session import get_session
from app.modules.generation_jobs.data.models import GenerationJobModel


router = APIRouter(tags=["generation_jobs"])


class GenerationJobStatus(BaseModel):
    """Normalized status payload consumed by the frontend."""

    job_id: uuid.UUID
    kind: str
    status: str
    stage: str | None = None
    stage_message: str | None = None
    progress_percent: int = 0
    target_kind: str | None = None
    target_id: uuid.UUID | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    error: str | None = None
    elapsed_ms: int
    result: dict[str, Any] | None = None


def _elapsed_ms(job: GenerationJobModel) -> int:
    start = job.started_at or job.created_at
    end = job.finished_at or datetime.now(timezone.utc)
    if start is None:
        return 0
    try:
        return max(0, int((end - start).total_seconds() * 1000))
    except Exception:
        return 0


def _to_payload(job: GenerationJobModel) -> GenerationJobStatus:
    return GenerationJobStatus(
        job_id=job.id,
        kind=job.kind,
        status=job.status,
        stage=job.stage,
        stage_message=job.stage_message,
        progress_percent=int(job.progress_percent or 0),
        target_kind=job.target_kind,
        target_id=job.target_id,
        started_at=job.started_at,
        finished_at=job.finished_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
        error=job.error_text,
        elapsed_ms=_elapsed_ms(job),
        result=job.result_json,
    )


@router.get("/generation-jobs/{job_id}", response_model=GenerationJobStatus)
async def get_generation_job(
    job_id: uuid.UUID,
    wait: bool = Query(False, description="Long-poll until job finishes"),
    timeout_sec: int = Query(30, ge=1, le=120),
    session: AsyncSession = Depends(get_session),
) -> GenerationJobStatus:
    """Return rich status of a generation job.

    When ``wait=true`` the endpoint long-polls the row for up to ``timeout_sec``
    seconds using short 1s intervals so the UI sees stage transitions almost
    instantly without hammering the API.
    """

    poll_interval = 1.0
    deadline = time.monotonic() + timeout_sec if wait else None

    while True:
        job = await session.get(GenerationJobModel, job_id)
        if job is None:
            raise NotFound("Задача генерации не найдена")

        payload = _to_payload(job)

        if not wait or job.status in {"done", "failed"}:
            return payload

        assert deadline is not None
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return payload

        await asyncio.sleep(min(poll_interval, remaining))
        # Force the session to read a fresh row on the next iteration.
        await session.rollback()
