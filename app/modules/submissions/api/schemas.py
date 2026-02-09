from __future__ import annotations

import uuid
from decimal import Decimal
from enum import Enum
from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.submissions.data.models import SubmissionStatus


class SubmissionAnswer(BaseModel):
    choice_ids: list[uuid.UUID] | None = None
    answer_numeric: Decimal | None = None
    answer_text: str | None = None


class SubmissionCreate(BaseModel):
    problem_id: uuid.UUID
    # Temporary field until auth is in place; can be omitted by frontend.
    user_id: uuid.UUID | None = None
    answer: SubmissionAnswer


class SubmissionResultOut(BaseModel):
    submission_id: uuid.UUID
    problem_id: uuid.UUID
    status: SubmissionStatus
    is_correct: bool | None
    score: int | None
    created_at: datetime
    message: str

