from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.data.db.base import Base


class SubjectModel(Base):
    __tablename__ = "subjects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    code: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
    )
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    name_kk: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name_en: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    topics: Mapped[list["TopicModel"]] = relationship(
        back_populates="subject",
        cascade="all, delete-orphan",
    )


class TopicModel(Base):
    __tablename__ = "topics"

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
    parent_topic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("topics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    title_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    title_kk: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title_en: Mapped[str | None] = mapped_column(String(255), nullable=True)

    grade_level: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )

    difficulty_level: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )
    order_no: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    subject: Mapped[SubjectModel] = relationship(back_populates="topics")
    parent_topic: Mapped["TopicModel | None"] = relationship(
        remote_side="TopicModel.id",
        back_populates="children",
    )
    children: Mapped[list["TopicModel"]] = relationship(
        back_populates="parent_topic",
        cascade="all, delete-orphan",
    )

