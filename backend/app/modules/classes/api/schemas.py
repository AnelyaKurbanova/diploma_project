from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


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


class AssessmentItemIn(BaseModel):
    problem_id: uuid.UUID
    points: int = Field(default=1, ge=1, le=100)


class ClassAssessmentCreateIn(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=3000)
    due_at: datetime | None = None
    time_limit_min: int | None = Field(default=None, ge=1, le=240)
    items: list[AssessmentItemIn] = Field(min_length=1, max_length=100)


class ClassAssessmentItemOut(BaseModel):
    id: uuid.UUID
    problem_id: uuid.UUID
    problem_title: str | None = None
    order_no: int
    points: int


class ClassAssessmentOut(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    title: str
    description: str | None
    due_at: datetime | None
    time_limit_min: int | None
    is_published: bool
    created_at: datetime
    items_count: int
    total_points: int


class ClassAssessmentDetailOut(ClassAssessmentOut):
    items: list[ClassAssessmentItemOut]


class StudentAssessmentOut(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    title: str
    description: str | None
    due_at: datetime | None
    time_limit_min: int | None
    items_count: int
    total_points: int


class StudentAssessmentItemOut(BaseModel):
    id: uuid.UUID
    problem_id: uuid.UUID
    problem_title: str | None = None
    order_no: int
    points: int


class StudentAssessmentDetailOut(StudentAssessmentOut):
    items: list[StudentAssessmentItemOut]


class TeacherAssessmentStudentProgressOut(BaseModel):
    student_id: uuid.UUID
    email: str
    full_name: str | None
    attempted_count: int
    solved_count: int
    total_items: int
    progress_percent: int
    score: int
    total_points: int


class TeacherAssessmentProgressOut(BaseModel):
    assessment_id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    assessment_title: str
    total_items: int
    total_points: int
    avg_progress_percent: int
    avg_score: int
    students: list[TeacherAssessmentStudentProgressOut]
