from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Output schemas
# ---------------------------------------------------------------------------

class LessonOut(BaseModel):
    id: uuid.UUID
    topic_id: uuid.UUID
    title: str
    order_no: int
    status: str
    created_at: datetime


class ContentBlockProblemOut(BaseModel):
    problem_id: uuid.UUID
    order_no: int


class ContentBlockOut(BaseModel):
    id: uuid.UUID
    block_type: str
    order_no: int
    title: str | None = None
    body: str | None = None
    video_url: str | None = None
    video_description: str | None = None
    problems: list[ContentBlockProblemOut] = []
    created_at: datetime
    updated_at: datetime


class LessonDetailOut(LessonOut):
    """Lesson with all content blocks (lecture, video, problem_set)."""
    content_blocks: list[ContentBlockOut] = []
    # Legacy field kept for backward compatibility
    theory_body: str | None = None
    # Legacy flat problem_ids kept for backward compatibility
    problem_ids: list[uuid.UUID] = []


# ---------------------------------------------------------------------------
# Input schemas
# ---------------------------------------------------------------------------

class LessonCreate(BaseModel):
    topic_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    order_no: int = Field(default=0, ge=0)


class LessonCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    order_no: int = Field(default=0, ge=0)


class LessonUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    order_no: int | None = Field(default=None, ge=0)


class ContentBlockCreate(BaseModel):
    block_type: str = Field(..., pattern=r"^(lecture|video|problem_set)$")
    order_no: int = Field(default=0, ge=0)
    title: str | None = Field(default=None, max_length=255)
    body: str | None = None
    video_url: str | None = Field(default=None, max_length=2048)
    video_description: str | None = None
    problem_ids: list[uuid.UUID] = []


class ContentBlockUpdate(BaseModel):
    order_no: int | None = Field(default=None, ge=0)
    title: str | None = Field(default=None, max_length=255)
    body: str | None = None
    video_url: str | None = Field(default=None, max_length=2048)
    video_description: str | None = None
    problem_ids: list[uuid.UUID] | None = None


class LessonProgressOut(BaseModel):
    user_id: uuid.UUID
    lesson_id: uuid.UUID
    completed: bool
    completed_at: datetime
    time_spent_sec: int | None = None


class LessonGenerateProblemsIn(BaseModel):
    """Параметры ИИ‑генерации задач для урока (RAG)."""

    # Можно просить больше 30 задач; на бэкенде генерация пойдёт батчами.
    count: int = Field(default=10, ge=1, le=100)


class LessonGenerateProblemsAcceptedOut(BaseModel):
    """Ответ при асинхронном запуске генерации задач (202)."""

    status: str = "accepted"
    message: str = (
        "Генерация задач запущена. Задачи появятся в блоке урока после завершения процесса."
    )


class LessonGenerateDraftAcceptedOut(BaseModel):
    """Ответ при асинхронном запуске генерации черновика лекции (202)."""

    status: str = "accepted"
    message: str = (
        "Генерация лекции запущена. Черновик появится в блоке урока после завершения."
    )
