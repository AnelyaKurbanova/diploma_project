from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class LessonOut(BaseModel):
    id: uuid.UUID
    topic_id: uuid.UUID
    title: str
    order_no: int
    created_at: datetime


class LessonDetailOut(LessonOut):
    theory_body: str | None
    problem_ids: list[uuid.UUID]

