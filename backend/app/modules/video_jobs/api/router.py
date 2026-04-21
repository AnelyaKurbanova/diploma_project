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
from app.modules.video_jobs.data.models import VideoJobModel


router = APIRouter(tags=["video_jobs"])


# Human-readable labels matching ``_STAGE_LABELS`` in the service but keyed by
# the coarser status field (worker statuses). Frontend falls back to these when
# ``stage_message`` is null (old rows created before the migration).
_STATUS_MESSAGES: dict[str, str] = {
    "planning": "Готовим сценарий видео",
    "queued": "Видео отправлено в рендер",
    "rendering": "Рендерим сцены видео",
    "merging": "Склеиваем сцены",
    "uploading": "Загружаем видео",
    "done": "Готово",
    "failed": "Ошибка при генерации видео",
}

# Baseline progress percentage derived from status (used when the row has not
# received an explicit progress_percent yet).
_STATUS_PROGRESS: dict[str, int] = {
    "planning": 10,
    "queued": 40,
    "rendering": 60,
    "merging": 85,
    "uploading": 95,
    "done": 100,
    "failed": 100,
}


class VideoJobStatus(BaseModel):
    """Rich status payload consumed by the frontend progress panel."""

    job_id: uuid.UUID
    status: str
    stage: str | None = None
    stage_message: str | None = None
    progress_percent: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    elapsed_ms: int = 0
    s3_url: str | None = None
    presigned_url: str | None = None
    error: str | None = None


def _elapsed_ms(job: VideoJobModel) -> int:
    start = job.started_at or job.created_at
    end = job.finished_at or datetime.now(timezone.utc)
    if start is None:
        return 0
    try:
        return max(0, int((end - start).total_seconds() * 1000))
    except Exception:
        return 0


def _derive_progress(job: VideoJobModel) -> int:
    """Prefer the explicit progress field, fall back to status-based guess."""

    if job.progress_percent and int(job.progress_percent) > 0:
        return int(job.progress_percent)
    return _STATUS_PROGRESS.get(job.status, 0)


def _derive_stage_message(job: VideoJobModel) -> str | None:
    if job.stage_message:
        return job.stage_message
    return _STATUS_MESSAGES.get(job.status)


def _build_payload(job: VideoJobModel) -> dict[str, Any]:
    result = job.result_json or {}
    return {
        "job_id": job.id,
        "status": job.status,
        "stage": job.status,
        "stage_message": _derive_stage_message(job),
        "progress_percent": _derive_progress(job),
        "started_at": job.started_at,
        "finished_at": job.finished_at,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "elapsed_ms": _elapsed_ms(job),
        "s3_url": result.get("s3_url"),
        "presigned_url": result.get("presigned_url"),
        "error": job.error_text,
    }


@router.get("/video-jobs/{job_id}", response_model=VideoJobStatus)
async def get_video_job_status(
    job_id: uuid.UUID,
    wait: bool = Query(False, description="Long-poll until finished"),
    timeout_sec: int = Query(
        30,
        ge=1,
        le=120,
        description="Maximum wait time in seconds when wait=true",
    ),
    session: AsyncSession = Depends(get_session),
) -> VideoJobStatus:
    """Return rich status of a video generation job.

    When ``wait=true`` the endpoint long-polls at 1 second intervals (cheap
    primary-key lookups) until the job reaches a terminal status or the
    client-provided deadline is reached. Stage transitions therefore surface
    to the UI almost instantly.
    """

    poll_interval = 1.0
    deadline = time.monotonic() + timeout_sec if wait else None

    while True:
        job = await session.get(VideoJobModel, job_id)
        if job is None:
            raise NotFound("Видео‑задача не найдена")

        payload = _build_payload(job)

        if not wait or job.status in {"done", "failed"}:
            return VideoJobStatus(**payload)

        assert deadline is not None
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return VideoJobStatus(**payload)

        await asyncio.sleep(min(poll_interval, remaining))
        await session.rollback()
