from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.data.db.base import Base


class SubmissionStatus(str, enum.Enum):
    PENDING = "pending"
    GRADED = "graded"
    NEEDS_REVIEW = "needs_review"


class SubmissionModel(Base):
    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("problems.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    status: Mapped[SubmissionStatus] = mapped_column(
        String(32),
        default=SubmissionStatus.PENDING.value,
        nullable=False,
    )
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_numeric: Mapped[float | None] = mapped_column(Numeric, nullable=True)


class SubmissionChoiceMapModel(Base):
    __tablename__ = "submission_choice_map"

    __table_args__ = (
        UniqueConstraint("submission_id", "choice_id", name="uq_submission_choice"),
    )

    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    choice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("problem_choices.id", ondelete="CASCADE"),
        primary_key=True,
    )

