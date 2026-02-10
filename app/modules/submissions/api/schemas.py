from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.modules.submissions.data.models import SubmissionStatus


class SubmissionAnswer(BaseModel):
    choice_ids: list[uuid.UUID] | None = None
    answer_numeric: Decimal | None = None
    answer_text: str | None = None


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

