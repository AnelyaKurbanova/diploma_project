from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.modules.submissions.data.models import SubmissionStatus


class SubmissionAnswer(BaseModel):
    choice_ids: list[uuid.UUID] | None = None
    answer_numeric: Decimal | None = None
    answer_text: str | None = Field(default=None, max_length=5000)


class SubmissionCreate(BaseModel):
    problem_id: uuid.UUID
    answer: SubmissionAnswer


class SubmissionResultOut(BaseModel):
    submission_id: uuid.UUID
    problem_id: uuid.UUID
    status: SubmissionStatus
    is_correct: bool | None
    score: int | None
    created_at: datetime
    message: str


class SubmissionProgressOut(BaseModel):
    has_attempt: bool
    last_status: SubmissionStatus | None = None
    last_is_correct: bool | None = None
    last_score: int | None = None
    last_answer_choice_ids: list[uuid.UUID] | None = None
    last_answer_text: str | None = None
    last_created_at: datetime | None = None


class SubmissionProgressItemOut(SubmissionProgressOut):
    problem_id: uuid.UUID


class SubmissionProgressBatchOut(BaseModel):
    items: list[SubmissionProgressItemOut]

