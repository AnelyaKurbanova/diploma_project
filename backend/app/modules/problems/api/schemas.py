from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field, field_validator

from app.modules.problems.data.models import (
    ProblemDifficulty,
    ProblemStatus,
    ProblemType,
)


class ProblemChoiceIn(BaseModel):
    choice_text: str = Field(min_length=1)
    is_correct: bool = False
    order_no: int = Field(default=0, ge=0)


class ProblemTagIn(BaseModel):
    name: str = Field(min_length=1, max_length=64)


class ProblemImageIn(BaseModel):
    url: str = Field(min_length=1, max_length=1024)
    order_no: int = Field(ge=0, le=2)
    alt_text: str | None = Field(default=None, max_length=255)


class ProblemAnswerKeyIn(BaseModel):
    numeric_answer: Decimal | None = None
    text_answer: str | None = None
    answer_pattern: str | None = None
    tolerance: Decimal | None = None


class ProblemBase(BaseModel):
    subject_id: uuid.UUID
    topic_id: uuid.UUID | None = None
    type: ProblemType
    difficulty: ProblemDifficulty = ProblemDifficulty.EASY

    title: str = Field(min_length=1, max_length=255)
    statement: str = Field(min_length=1)
    explanation: str | None = None

    time_limit_sec: int = Field(default=60, ge=1)
    points: int = Field(default=1, ge=1)


class ProblemCreate(ProblemBase):
    choices: list[ProblemChoiceIn] | None = None
    tags: list[ProblemTagIn] | None = None
    answer_key: ProblemAnswerKeyIn | None = None
    images: list[ProblemImageIn] | None = Field(default=None, max_length=3)

    @field_validator("type")
    @classmethod
    def _forbid_numeric_type(cls, v: ProblemType) -> ProblemType:
        if v is ProblemType.NUMERIC:
            from app.core.i18n import tr
            raise ValueError(tr("numeric_type_deprecated"))
        return v


class ProblemUpdate(BaseModel):
    subject_id: uuid.UUID | None = None
    topic_id: uuid.UUID | None = None
    difficulty: ProblemDifficulty | None = None

    title: str | None = Field(default=None, min_length=1, max_length=255)
    statement: str | None = Field(default=None, min_length=1)
    explanation: str | None = None

    time_limit_sec: int | None = Field(default=None, ge=1)
    points: int | None = Field(default=None, ge=1)

    choices: list[ProblemChoiceIn] | None = None
    tags: list[ProblemTagIn] | None = None
    answer_key: ProblemAnswerKeyIn | None = None
    images: list[ProblemImageIn] | None = Field(default=None, max_length=3)


class ProblemChoiceOut(BaseModel):
    id: uuid.UUID
    choice_text: str
    is_correct: bool
    order_no: int


class ProblemTagOut(BaseModel):
    id: uuid.UUID
    name: str


class ProblemAnswerKeyOut(BaseModel):
    numeric_answer: Decimal | None = None
    text_answer: str | None = None
    answer_pattern: str | None = None
    tolerance: Decimal | None = None
    canonical_answer: str | None = None


class ProblemImageOut(BaseModel):
    id: uuid.UUID
    url: str
    order_no: int
    alt_text: str | None


class ProblemOut(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    topic_id: uuid.UUID | None
    type: ProblemType
    difficulty: ProblemDifficulty
    title: str
    statement: str
    explanation: str | None
    time_limit_sec: int
    points: int
    choices: list[ProblemChoiceOut]
    tags: list[ProblemTagOut]
    images: list[ProblemImageOut]


class ProblemAdminOut(ProblemOut):
    status: ProblemStatus
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    answer_key: ProblemAnswerKeyOut | None


class ProblemAdminListOut(BaseModel):
    items: list[ProblemAdminOut]
    total: int
    page: int
    per_page: int

