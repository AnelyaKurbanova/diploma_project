from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.data.db.base import Base


class LessonStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class LessonModel(Base):
    __tablename__ = "lessons"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    topic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("topics.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped["LessonStatus"] = mapped_column(
        SAEnum(
            LessonStatus,
            name="lesson_status",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
        default="draft",
        server_default="draft",
        index=True,
    )

    # Legacy field kept for backward compatibility during migration
    theory_body: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    content_blocks: Mapped[list["LessonContentBlockModel"]] = relationship(
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="LessonContentBlockModel.order_no",
    )


# ---------------------------------------------------------------------------
# Content block types
# ---------------------------------------------------------------------------

class BlockType(str, enum.Enum):
    LECTURE = "lecture"
    VIDEO = "video"
    PROBLEM_SET = "problem_set"


class LessonContentBlockModel(Base):
    __tablename__ = "lesson_content_blocks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    block_type: Mapped[BlockType] = mapped_column(
        SAEnum(
            BlockType,
            name="block_type",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
    )
    order_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # --- lecture fields ---
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- video fields ---
    video_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    video_description: Mapped[str | None] = mapped_column(Text, nullable=True)

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

    lesson: Mapped[LessonModel] = relationship(back_populates="content_blocks")
    problem_links: Mapped[list["BlockProblemMapModel"]] = relationship(
        back_populates="content_block",
        cascade="all, delete-orphan",
        order_by="BlockProblemMapModel.order_no",
    )


class BlockProblemMapModel(Base):
    __tablename__ = "block_problem_map"

    content_block_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lesson_content_blocks.id", ondelete="CASCADE"),
        primary_key=True,
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("problems.id", ondelete="CASCADE"),
        primary_key=True,
    )
    order_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    content_block: Mapped[LessonContentBlockModel] = relationship(
        back_populates="problem_links",
    )


# ---------------------------------------------------------------------------
# Legacy mapping (kept for backward compat / migration)
# ---------------------------------------------------------------------------

class LessonProblemMapModel(Base):
    __tablename__ = "lesson_problem_map"

    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        primary_key=True,
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("problems.id", ondelete="CASCADE"),
        primary_key=True,
    )
    order_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------

class LessonProgressModel(Base):
    __tablename__ = "lesson_progress"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        primary_key=True,
    )
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    time_spent_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)
