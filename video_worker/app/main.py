from __future__ import annotations

import asyncio
import logging
import time
import uuid
from pathlib import Path
from typing import Any, Dict

from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from .db import create_engine, create_session_factory
from .ffmpeg import concat_videos
from .logging import configure_logging
from .models import Base
from .rabbit import Rabbit
from .render import render_scenes
from .repo import JobNotFoundError, load_job, set_result, set_status
from .s3 import S3Client
from .settings import get_settings
from .validators import ContentValidationError, PlanValidationError, validate_content, validate_plan


LOGGER = logging.getLogger(__name__)


async def handle_requested_message(
    job_id_str: str,
    session_factory: async_sessionmaker[AsyncSession],
    s3_client: S3Client,
    rabbit: Rabbit,
    work_dir: Path,
    content_max_retries: int,
) -> None:
    job_uuid = uuid.UUID(job_id_str)

    async with session_factory() as session:
        try:
            job = await load_job(session, job_uuid)
        except JobNotFoundError:
            LOGGER.error("Job not found", extra={"job_id": job_id_str})
            return

        # Idempotency and recovery rules:
        # - done/planning: ignore duplicates
        # - rendering/merging/uploading: allow recovery after broker/channel reconnect
        if job.status in {"done", "planning"}:
            LOGGER.info(
                "Ignoring job with non-queued status",
                extra={"job_id": job_id_str},
            )
            return
        if job.status in {"rendering", "merging", "uploading"}:
            LOGGER.warning(
                "Recovering in-progress job after re-delivery",
                extra={"job_id": job_id_str, "status": job.status},
            )
        elif job.status not in {"queued", "failed"}:
            LOGGER.info(
                "Ignoring job with unexpected status",
                extra={"job_id": job_id_str, "status": job.status},
            )
            return

        timings: Dict[str, int] = {}

        try:
            # 1) Content уже подготовлен в монолите: ожидаем полный content_json в plan_json.
            await set_status(session, job, "rendering")
            t1 = time.perf_counter()
            content_raw: Dict[str, Any] | None = None
            if job.plan_json:
                if isinstance(job.plan_json, dict) and "scenes" in job.plan_json:
                    content_raw = job.plan_json  # монолит положил готовый content_json
                else:
                    # На всякий случай позволим варианту { "content": { ... } }
                    maybe_content = job.plan_json.get("content") if isinstance(job.plan_json, dict) else None
                    if isinstance(maybe_content, dict):
                        content_raw = maybe_content

            if content_raw is None:
                raise ContentValidationError("job.plan_json не содержит готового сценария видео")

            content = validate_content(content_raw)

            job_work_dir = work_dir / job_id_str
            scene_paths = await asyncio.to_thread(render_scenes, content, job_work_dir)
            timings["rendering_ms"] = int((time.perf_counter() - t1) * 1000)

            # 2) Merging
            await set_status(session, job, "merging")
            t2 = time.perf_counter()
            final_path = await asyncio.to_thread(
                concat_videos,
                scene_paths,
                job_work_dir / "final",
            )
            timings["merging_ms"] = int((time.perf_counter() - t2) * 1000)

            # 3) Uploading
            await set_status(session, job, "uploading")
            t3 = time.perf_counter()
            s3_url = await asyncio.to_thread(
                s3_client.upload_final_video,
                job_id_str,
                final_path,
            )
            key = f"videos/{job_id_str}/final.mp4"
            presigned_url = await asyncio.to_thread(
                s3_client.generate_presigned_url,
                key,
            )
            timings["uploading_ms"] = int((time.perf_counter() - t3) * 1000)

            result_json = {
                "s3_url": s3_url,
                "presigned_url": presigned_url,
                "timings": timings,
            }
            await set_result(
                session=session,
                job=job,
                status="done",
                result_json=result_json,
                error_text=None,
            )

            await rabbit.publish_event(
                "video.completed",
                {"job_id": job_id_str, "s3_url": s3_url},
            )
            LOGGER.info(
                "Job completed successfully",
                extra={"job_id": job_id_str},
            )
        except (PlanValidationError, ContentValidationError) as exc:
            await set_result(
                session=session,
                job=job,
                status="failed",
                result_json={"timings": timings},
                error_text=str(exc),
            )
            await rabbit.publish_event(
                "video.failed",
                {"job_id": job_id_str, "error": str(exc)},
            )
            LOGGER.error(
                "Job failed due to validation error",
                extra={"job_id": job_id_str},
            )
        except Exception as exc:  # noqa: BLE001
            await set_result(
                session=session,
                job=job,
                status="failed",
                result_json={"timings": timings},
                error_text=str(exc),
            )
            await rabbit.publish_event(
                "video.failed",
                {"job_id": job_id_str, "error": str(exc)},
            )
            LOGGER.exception(
                "Job failed due to unexpected error",
                extra={"job_id": job_id_str},
            )


async def _async_main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)

    LOGGER.info("Starting video worker service")

    engine = create_engine(settings)
    # Ensure metadata is loaded (no migrations; table must already exist).
    Base.metadata.bind = engine
    session_factory = create_session_factory(engine)

    s3_client = S3Client(settings)

    rabbit = Rabbit(
        settings.rabbit_url,
        heartbeat_seconds=settings.rabbit_heartbeat_seconds,
    )
    await rabbit.connect()

    async def handler(job_id: str) -> None:
        await handle_requested_message(
            job_id_str=job_id,
            session_factory=session_factory,
            s3_client=s3_client,
            rabbit=rabbit,
            work_dir=settings.work_dir,
            content_max_retries=settings.content_max_retries,
        )

    await rabbit.consume_requested(handler)

    # Keep the service running indefinitely.
    await asyncio.Future()


def main() -> None:
    asyncio.run(_async_main())


if __name__ == "__main__":
    main()

