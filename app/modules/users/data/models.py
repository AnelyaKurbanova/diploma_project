from __future__ import annotations

import enum
import uuid

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import (
    String,
    DateTime,
    func,
    Boolean,
    ForeignKey,
    Integer,
    Text,
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID

from app.data.db.base import Base


class UserRole(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    CONTENT_MAKER = "content_maker"
    MODERATOR = "moderator"
    ADMIN = "admin"


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    is_email_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    role: Mapped[UserRole] = mapped_column(
        SAEnum(
            UserRole,
            name="user_role",
            # Store enum .value in DB ('student', 'teacher', ...)
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=UserRole.STUDENT,
        server_default=UserRole.STUDENT.value,
    )

    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[object] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class UserProfileModel(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    school: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)

    grade_level: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    preferred_language: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="ru",
        server_default="ru",
    )
    timezone: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="Asia/Almaty",
        server_default="Asia/Almaty",
    )

    # Onboarding-related fields
    intro_difficulties: Mapped[str | None] = mapped_column(Text, nullable=True)
    intro_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    onboarding_completed_at: Mapped[object | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[object] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
