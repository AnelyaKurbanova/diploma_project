from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.data.db.base import Base


class VideoJobModel(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    status: Mapped[str] = mapped_column(String, nullable=False)
    request_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    plan_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    result_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Live progress metadata for the UI. Populated by both the monolith
    # (during content planning) and the video worker (during rendering).
    progress_percent: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0", default=0
    )
    stage_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
