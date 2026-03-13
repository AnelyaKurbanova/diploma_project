from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SubjectCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64)
    name_ru: str = Field(min_length=2, max_length=255)
    name_kk: str | None = Field(default=None, max_length=255)
    name_en: str | None = Field(default=None, max_length=255)


class SubjectUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=64)
    name_ru: str | None = Field(default=None, min_length=2, max_length=255)
    name_kk: str | None = Field(default=None, max_length=255)
    name_en: str | None = Field(default=None, max_length=255)


class SubjectOut(BaseModel):
    id: uuid.UUID
    code: str
    name_ru: str
    name_kk: str | None
    name_en: str | None
    topic_count: int
    created_at: datetime


class TopicCreate(BaseModel):
    subject_id: uuid.UUID
    grade_level: int = Field(ge=1, le=11)

    title_ru: str = Field(min_length=2, max_length=255)
    title_kk: str | None = Field(default=None, max_length=255)
    title_en: str | None = Field(default=None, max_length=255)


class TopicUpdate(BaseModel):
    title_ru: str | None = Field(default=None, min_length=2, max_length=255)
    title_kk: str | None = Field(default=None, max_length=255)
    title_en: str | None = Field(default=None, max_length=255)
    grade_level: int | None = Field(default=None, ge=1, le=11)


class TopicOut(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    grade_level: int | None
    title_ru: str
    title_kk: str | None
    title_en: str | None
    created_at: datetime

