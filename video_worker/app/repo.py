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


async def set_status(
    session: AsyncSession,
    job: Job,
    status: str,
) -> None:
    job.status = status
    job.updated_at = _now()
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

