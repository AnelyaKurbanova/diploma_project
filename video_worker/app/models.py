from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True
    )
    status: Mapped[str] = mapped_column(String, nullable=False)
    request_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False
    )
    plan_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True
    )
    result_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True
    )
    error_text: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

