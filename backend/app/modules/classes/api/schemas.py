from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class ClassBase(BaseModel):
    name: str


class TeacherClassOut(BaseModel):
    id: uuid.UUID
    name: str
    join_code: str
    created_at: datetime
    students_count: int


class ClassStudentOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    joined_at: datetime
    overall_progress: int | None = None


class ClassStatsOut(BaseModel):
    total_students: int
    avg_overall_progress: int


class ClassDetailOut(BaseModel):
    id: uuid.UUID
    name: str
    join_code: str
    created_at: datetime
    students: list[ClassStudentOut]
    stats: ClassStatsOut


class JoinClassIn(BaseModel):
    join_code: str


class StudentClassOut(BaseModel):
    id: uuid.UUID
    name: str
    teacher_name: str | None
    joined_at: datetime
    overall_progress: int | None = None

