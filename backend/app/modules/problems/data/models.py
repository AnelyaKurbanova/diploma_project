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
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.data.db.base import Base


class ProblemType(str, enum.Enum):
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    NUMERIC = "numeric"
    SHORT_TEXT = "short_text"
    MATCH = "match"


class ProblemDifficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class ProblemStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ProblemModel(Base):
    __tablename__ = "problems"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("topics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    type: Mapped[ProblemType] = mapped_column(
        SAEnum(ProblemType, name="problem_type"),
        nullable=False,
    )
    difficulty: Mapped[ProblemDifficulty] = mapped_column(
        SAEnum(ProblemDifficulty, name="problem_difficulty"),
        nullable=False,
        default=ProblemDifficulty.EASY,
    )
    status: Mapped[ProblemStatus] = mapped_column(
        SAEnum(ProblemStatus, name="problem_status"),
        nullable=False,
        default=ProblemStatus.DRAFT,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

    time_limit_sec: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
        comment="Author user id; FK defined in migrations",
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

    choices: Mapped[list["ProblemChoiceModel"]] = relationship(
        back_populates="problem",
        cascade="all, delete-orphan",
    )
    tags: Mapped[list["ProblemTagMapModel"]] = relationship(
        back_populates="problem",
        cascade="all, delete-orphan",
    )
    answer_keys: Mapped["ProblemAnswerKeyModel | None"] = relationship(
        back_populates="problem",
        uselist=False,
        cascade="all, delete-orphan",
    )
    images: Mapped[list["ProblemImageModel"]] = relationship(
        back_populates="problem",
        cascade="all, delete-orphan",
        order_by="ProblemImageModel.order_no",
    )


class ProblemTagModel(Base):
    __tablename__ = "problem_tags"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    mappings: Mapped[list["ProblemTagMapModel"]] = relationship(
        back_populates="tag",
        cascade="all, delete-orphan",
    )


class ProblemTagMapModel(Base):
    __tablename__ = "problem_tag_map"

    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("problems.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("problem_tags.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    problem: Mapped[ProblemModel] = relationship(back_populates="tags")
    tag: Mapped[ProblemTagModel] = relationship(back_populates="mappings")


class ProblemChoiceModel(Base):
    __tablename__ = "problem_choices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("problems.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    choice_text: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    order_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    problem: Mapped[ProblemModel] = relationship(back_populates="choices")


class ProblemAnswerKeyModel(Base):
    __tablename__ = "problem_answer_keys"

    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("problems.id", ondelete="CASCADE"),
        primary_key=True,
    )
    numeric_answer: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    text_answer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    answer_pattern: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tolerance: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    canonical_answer: Mapped[str | None] = mapped_column(String(512), nullable=True)

    problem: Mapped[ProblemModel] = relationship(back_populates="answer_keys")


class ProblemImageModel(Base):
    __tablename__ = "problem_images"

    __table_args__ = (
        UniqueConstraint("problem_id", "order_no", name="uq_problem_image_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("problems.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    order_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    alt_text: Mapped[str | None] = mapped_column(String(255), nullable=True)

    problem: Mapped[ProblemModel] = relationship(back_populates="images")
