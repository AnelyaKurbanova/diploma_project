from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Job


class JobNotFoundError(Exception):
    pass


async def load_job(session: AsyncSession, job_id: uuid.UUID) -> Job:
    """Load a job by ID or raise JobNotFoundError."""

    result = await session.execute(
        select(Job).where(Job.id == job_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise JobNotFoundError(f"Job {job_id} not found")
    return job


def _now() -> datetime:
    return datetime.now(timezone.utc)


# Progress baseline per stage. Worker takes over at "rendering" (45%).
# The monolith planning stages cover 0..45%. The worker covers 45..100%:
#   rendering 45, merging 85, uploading 95, done 100.
STAGE_PROGRESS = {
    "queued": 40,
    "rendering": 45,
    "merging": 85,
    "uploading": 95,
    "done": 100,
    "failed": 100,
}

# Human-readable stage messages shown to the user. Russian so they match
# existing UI strings.
STAGE_MESSAGES = {
    "queued": "Ожидаем рендеринг сцен",
    "rendering": "Рендерим сцены видео",
    "merging": "Склеиваем сцены",
    "uploading": "Загружаем видео",
    "done": "Готово",
    "failed": "Ошибка при генерации видео",
}


async def set_status(
    session: AsyncSession,
    job: Job,
    status: str,
    *,
    progress_percent: Optional[int] = None,
    stage_message: Optional[str] = None,
) -> None:
    """Update status plus derived progress fields in a single commit."""

    job.status = status
    job.updated_at = _now()
    if job.started_at is None and status != "failed":
        job.started_at = _now()

    if progress_percent is None:
        progress_percent = STAGE_PROGRESS.get(status)
    if progress_percent is not None:
        job.progress_percent = max(0, min(100, int(progress_percent)))

    if stage_message is None:
        stage_message = STAGE_MESSAGES.get(status)
    if stage_message is not None:
        job.stage_message = stage_message

    if status in {"done", "failed"} and job.finished_at is None:
        job.finished_at = _now()

    await session.commit()


async def set_plan(
    session: AsyncSession,
    job: Job,
    plan_json: Mapping[str, Any],
) -> None:
    job.plan_json = dict(plan_json)
    job.updated_at = _now()
    await session.commit()


async def set_result(
    session: AsyncSession,
    job: Job,
    status: str,
    result_json: Optional[Mapping[str, Any]],
    error_text: Optional[str],
) -> None:
    job.status = status
    job.error_text = error_text
    job.result_json = dict(result_json) if result_json is not None else None
    job.updated_at = _now()
    if status in {"done", "failed"} and job.finished_at is None:
        job.finished_at = _now()
    if status == "done":
        job.progress_percent = 100
        job.stage_message = STAGE_MESSAGES["done"]
    elif status == "failed":
        job.stage_message = (error_text or STAGE_MESSAGES["failed"])[:500]
    await session.commit()


async def set_failed(
    session: AsyncSession,
    job: Job,
    error_text: str,
) -> None:
    await set_result(
        session=session,
        job=job,
        status="failed",
        result_json=job.result_json,
        error_text=error_text,
    )


async def update_timings(
    session: AsyncSession,
    job: Job,
    **timings_ms: int,
) -> None:
    """Merge timing metrics into result_json.timings."""

    result: Dict[str, Any] = dict(job.result_json or {})
    timings: Dict[str, Any] = dict(result.get("timings") or {})
    for key, value in timings_ms.items():
        timings[key] = int(value)
    result["timings"] = timings

    job.result_json = result
    job.updated_at = _now()
    await session.commit()
