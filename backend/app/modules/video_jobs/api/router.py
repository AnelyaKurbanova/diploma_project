from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.data.db.session import get_session
from app.modules.video_jobs.data.models import VideoJobModel


router = APIRouter(tags=["video_jobs"])


class VideoJobStatus(BaseModel):
    job_id: uuid.UUID
    status: str
    s3_url: str | None = None
    presigned_url: str | None = None
    error: str | None = None


def _build_payload(job: VideoJobModel) -> dict[str, Any]:
    result = job.result_json or {}
    return {
        "job_id": job.id,
        "status": job.status,
        "s3_url": result.get("s3_url"),
        "presigned_url": result.get("presigned_url"),
        "error": job.error_text,
    }


@router.get("/video-jobs/{job_id}", response_model=VideoJobStatus)
async def get_video_job_status(
    job_id: uuid.UUID,
    wait: bool = Query(False, description="Если true, ждать завершения задачи"),
    timeout_sec: int = Query(
        60,
        ge=1,
        le=600,
        description="Максимальное время ожидания в секундах",
    ),
    session: AsyncSession = Depends(get_session),
) -> VideoJobStatus:
    """Получить статус задачи генерации видео.

    Если wait=true, эндпоинт опрашивает БД каждые 5 секунд, пока статус
    не станет done/failed или не истечет timeout_sec.
    """

    poll_interval = 5.0
    deadline = time.monotonic() + timeout_sec if wait else None

    while True:
        result = await session.execute(
            select(VideoJobModel).where(VideoJobModel.id == job_id)
        )
        job = result.scalar_one_or_none()
        if job is None:
            raise NotFound("Видео‑задача не найдена")

        payload = _build_payload(job)

        if not wait:
            return VideoJobStatus(**payload)

        if job.status in {"done", "failed"}:
            return VideoJobStatus(**payload)

        assert deadline is not None
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            # Вернуть текущий статус, даже если еще не готово
            return VideoJobStatus(**payload)

        await asyncio.sleep(min(poll_interval, remaining))

