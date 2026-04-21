from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Mapping

from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import SessionLocal
from app.modules.generation_jobs.data.models import GenerationJobModel


LOGGER = logging.getLogger(__name__)


# Canonical statuses. Frontend expects only these values.
STATUS_PENDING = "pending"
STATUS_RUNNING = "running"
STATUS_DONE = "done"
STATUS_FAILED = "failed"


class GenerationJobTracker:
    """Small helper wrapping a single generation job row.

    Keeps the tracking logic (progress, stage, error handling) in one place so
    the callers just use two methods: ``update(...)`` and ``complete(...)``.
    All updates happen in short-lived sessions so we never hold a DB connection
    during the LLM call.
    """

    def __init__(self, job_id: uuid.UUID) -> None:
        self.job_id = job_id

    async def update(
        self,
        *,
        status: str | None = None,
        stage: str | None = None,
        stage_message: str | None = None,
        progress_percent: int | None = None,
        error_text: str | None = None,
        result_json: Mapping[str, Any] | None = None,
    ) -> None:
        """Update only the provided fields of the job row."""

        async with SessionLocal() as session:
            job = await session.get(GenerationJobModel, self.job_id)
            if job is None:
                LOGGER.warning(
                    "GenerationJobTracker.update: job not found job_id=%s",
                    self.job_id,
                )
                return

            if status is not None:
                job.status = status
                if status == STATUS_RUNNING and job.started_at is None:
                    job.started_at = datetime.now(timezone.utc)
                if status in {STATUS_DONE, STATUS_FAILED} and job.finished_at is None:
                    job.finished_at = datetime.now(timezone.utc)
            if stage is not None:
                job.stage = stage
            if stage_message is not None:
                job.stage_message = stage_message
            if progress_percent is not None:
                job.progress_percent = max(0, min(100, int(progress_percent)))
            if error_text is not None:
                job.error_text = error_text
            if result_json is not None:
                job.result_json = dict(result_json)

            await session.commit()

    async def complete(
        self,
        *,
        result_json: Mapping[str, Any] | None = None,
        stage_message: str | None = None,
    ) -> None:
        await self.update(
            status=STATUS_DONE,
            stage="done",
            stage_message=stage_message or "Готово",
            progress_percent=100,
            result_json=result_json,
        )

    async def fail(self, error_text: str) -> None:
        await self.update(
            status=STATUS_FAILED,
            stage="failed",
            stage_message=error_text[:500] if error_text else None,
            error_text=error_text,
        )


async def create_job(
    session: AsyncSession,
    *,
    kind: str,
    target_kind: str | None = None,
    target_id: uuid.UUID | None = None,
    created_by: uuid.UUID | None = None,
    request_json: Mapping[str, Any] | None = None,
    stage: str = "queued",
    stage_message: str = "Задача поставлена в очередь",
) -> GenerationJobModel:
    """Create a new generation_job row in the provided session and commit it.

    The caller is responsible for starting the background work after this
    returns, passing ``job.id`` so progress can be reported via
    :class:`GenerationJobTracker`.
    """

    job = GenerationJobModel(
        kind=kind,
        target_kind=target_kind,
        target_id=target_id,
        created_by=created_by,
        request_json=dict(request_json or {}),
        status=STATUS_PENDING,
        stage=stage,
        stage_message=stage_message,
        progress_percent=0,
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job


async def find_active_job(
    session: AsyncSession,
    *,
    kind: str,
    target_kind: str,
    target_id: uuid.UUID,
) -> GenerationJobModel | None:
    """Return the most recent *active* job (pending/running) for the target.

    Used to short-circuit duplicate generation requests from the UI: if the
    user double-clicks, we simply reuse the existing job instead of spawning
    a second one.
    """

    from sqlalchemy import select

    stmt = (
        select(GenerationJobModel)
        .where(
            GenerationJobModel.kind == kind,
            GenerationJobModel.target_kind == target_kind,
            GenerationJobModel.target_id == target_id,
            GenerationJobModel.status.in_([STATUS_PENDING, STATUS_RUNNING]),
        )
        .order_by(GenerationJobModel.created_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()
