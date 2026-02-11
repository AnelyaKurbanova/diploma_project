from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.modules.users.data.models import UserRole

PrimaryGoal = Literal[
    "unt_prep",
    "problem_solving",
    "material_review",
    "classroom_learning",
]


class UserProfileOut(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    is_email_verified: bool
    is_active: bool

    full_name: str | None
    school_id: uuid.UUID | None
    school: str | None
    city: str | None
    grade_level: int | None
    preferred_language: str
    timezone: str

    primary_goal: str | None
    interested_subjects: list[str] | None
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
    full_name: str | None = Field(default=None, max_length=255)
    is_teacher: bool
    school_id: uuid.UUID | None = Field(default=None)
    teacher_code: str | None = Field(default=None, max_length=64)
    grade_level: int | None = Field(default=None, ge=1, le=11)
    primary_goal: PrimaryGoal | None = Field(default=None, max_length=64)
    interested_subjects: list[str] | None = Field(default=None)
    difficulties: str | None = Field(default=None, max_length=5000)
    notes: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def teacher_requires_school_and_code(self):
        if self.is_teacher and (self.school_id is None or not (self.teacher_code or "").strip()):
            raise ValueError("Для роли учителя необходимо указать школу и код учителя")
        return self


class AdminSetRoleIn(BaseModel):
    role: UserRole


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    role: UserRole | None = None


class AdminUserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    is_email_verified: bool
    is_active: bool
    created_at: datetime


class AdminUserListOut(BaseModel):
    items: list[AdminUserOut]
    total: int
    page: int
    per_page: int

