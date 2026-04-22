from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Mapping

from sqlalchemy import func, select
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


# ---------------------------------------------------------------------------
# Global one-at-a-time queue pump for all generation jobs
# ---------------------------------------------------------------------------

_GENERATION_PUMP_LOCK = asyncio.Lock()


async def pump_generation_queue() -> None:
    """Start the oldest pending generation job if none is currently running.

    All generation kinds (lesson_draft, lesson_problems, …) share one global
    slot so LLM calls run strictly one at a time.  Jobs are persisted in the
    ``generation_jobs`` table, so they survive server restarts — the lifespan
    poller in main.py re-drains the queue after any restart.
    """
    job_id: uuid.UUID | None = None
    kind: str | None = None
    rj: dict = {}

    async with _GENERATION_PUMP_LOCK:
        async with SessionLocal() as session:
            # Skip if another job is already running.
            r = await session.execute(
                select(func.count())
                .select_from(GenerationJobModel)
                .where(GenerationJobModel.status == STATUS_RUNNING),
            )
            if int(r.scalar() or 0) > 0:
                return

            # Claim the oldest pending job atomically (SKIP LOCKED prevents
            # double-pickup when multiple Uvicorn workers are running).
            res = await session.execute(
                select(GenerationJobModel)
                .where(GenerationJobModel.status == STATUS_PENDING)
                .order_by(GenerationJobModel.created_at.asc())
                .limit(1)
                .with_for_update(skip_locked=True)
            )
            job = res.scalars().first()
            if job is None:
                return

            job_id = job.id
            kind = job.kind
            rj = dict(job.request_json or {})

            job.status = STATUS_RUNNING
            if job.started_at is None:
                job.started_at = datetime.now(timezone.utc)
            await session.commit()

    if job_id is None or kind is None:
        return

    # Dispatch to the appropriate runner.  Lazy imports break the potential
    # circular-import cycle (lessons router imports this service at module
    # load; this service imports the runners only when called at runtime).
    if kind == "lesson_draft":
        from app.modules.lessons.api.router import _run_generate_draft  # noqa: PLC0415
        lesson_id = uuid.UUID(str(rj["lesson_id"]))
        allow_pub = bool(rj.get("allow_published_edit", False))
        asyncio.create_task(_run_generate_draft(job_id, lesson_id, allow_pub))

    elif kind == "lesson_problems":
        from app.modules.lessons.api.router import _run_generate_problems  # noqa: PLC0415
        lesson_id = uuid.UUID(str(rj["lesson_id"]))
        count = int(rj.get("count", 10))
        created_by_raw = rj.get("created_by")
        created_by = uuid.UUID(str(created_by_raw)) if created_by_raw else None
        allow_pub = bool(rj.get("allow_published_edit", False))
        asyncio.create_task(
            _run_generate_problems(job_id, lesson_id, count, created_by, allow_pub)
        )

    else:
        LOGGER.error("pump_generation_queue: unknown kind=%s job_id=%s", kind, job_id)
        async with SessionLocal() as session:
            job = await session.get(GenerationJobModel, job_id)
            if job is not None:
                job.status = STATUS_FAILED
                job.error_text = f"Unknown job kind: {kind}"
                job.finished_at = datetime.now(timezone.utc)
                await session.commit()
        asyncio.create_task(pump_generation_queue())


async def reset_stuck_running_jobs() -> None:
    """On server startup, move any leftover ``running`` jobs back to ``pending``.

    A ``running`` status means the previous process was killed mid-execution.
    Resetting to ``pending`` lets the pump retry them on the next tick.
    """
    async with SessionLocal() as session:
        await session.execute(
            GenerationJobModel.__table__.update()
            .where(GenerationJobModel.status == STATUS_RUNNING)
            .values(
                status=STATUS_PENDING,
                stage_message="Возобновление после перезапуска сервера",
                started_at=None,
            )
        )
        await session.commit()
