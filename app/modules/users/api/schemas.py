from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.users.data.models import UserRole


class UserProfileOut(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    is_email_verified: bool
    is_active: bool

    full_name: str | None
    school: str | None
    city: str | None
    grade_level: int | None
    preferred_language: str
    timezone: str

    intro_difficulties: str | None
    intro_notes: str | None
    onboarding_completed_at: datetime | None

    created_at: datetime
    updated_at: datetime


class UserProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    school: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=255)
    grade_level: int | None = Field(default=None, ge=1, le=11)
    preferred_language: str | None = Field(default=None, max_length=16)
    timezone: str | None = Field(default=None, max_length=64)


class OnboardingIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    is_teacher: bool
    grade_level: int | None = Field(default=None, ge=1, le=11)
    difficulties: str | None = Field(default=None, max_length=5000)
    notes: str | None = Field(default=None, max_length=5000)

