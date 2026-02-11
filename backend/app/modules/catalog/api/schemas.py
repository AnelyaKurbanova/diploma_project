from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SubjectCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64)
    name_ru: str = Field(min_length=2, max_length=255)
    name_kk: str | None = Field(default=None, max_length=255)
    name_en: str | None = Field(default=None, max_length=255)
    description_ru: str | None = Field(default=None)
    description_kk: str | None = Field(default=None)
    description_en: str | None = Field(default=None)


class SubjectUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=64)
    name_ru: str | None = Field(default=None, min_length=2, max_length=255)
    name_kk: str | None = Field(default=None, max_length=255)
    name_en: str | None = Field(default=None, max_length=255)
    description_ru: str | None = Field(default=None)
    description_kk: str | None = Field(default=None)
    description_en: str | None = Field(default=None)


class SubjectOut(BaseModel):
    id: uuid.UUID
    code: str
    name_ru: str
    name_kk: str | None
    name_en: str | None
    description_ru: str | None
    description_kk: str | None
    description_en: str | None
    topic_count: int
    created_at: datetime


class TopicCreate(BaseModel):
    subject_id: uuid.UUID
    parent_topic_id: uuid.UUID | None = None

    title_ru: str = Field(min_length=2, max_length=255)
    title_kk: str | None = Field(default=None, max_length=255)
    title_en: str | None = Field(default=None, max_length=255)

    grade_level: int | None = Field(default=None, ge=1, le=11)
    order_no: int = Field(default=0, ge=0)


class TopicUpdate(BaseModel):
    subject_id: uuid.UUID | None = None
    parent_topic_id: uuid.UUID | None = None

    title_ru: str | None = Field(default=None, min_length=2, max_length=255)
    title_kk: str | None = Field(default=None, max_length=255)
    title_en: str | None = Field(default=None, max_length=255)

    grade_level: int | None = Field(default=None, ge=1, le=11)
    order_no: int | None = Field(default=None, ge=0)


class TopicOut(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    parent_topic_id: uuid.UUID | None
    title_ru: str
    title_kk: str | None
    title_en: str | None
    grade_level: int | None
    order_no: int
    created_at: datetime

