from __future__ import annotations

from pydantic import BaseModel


class SubjectProgressOut(BaseModel):
    code: str
    name: str
    mastery: int
    completed_topics: int
    total_topics: int


class TaskDistributionOut(BaseModel):
    correct: int
    incorrect: int
    unsolved: int


class RecommendationOut(BaseModel):
    subject_code: str
    subject_name: str
    mastery: int
    message: str


class DashboardStatsOut(BaseModel):
    overall_progress: int
    completed_lectures: int
    total_lectures: int
    solved_tasks: int
    total_tasks: int
    accuracy: int
    subjects_progress: list[SubjectProgressOut]
    task_distribution: TaskDistributionOut
    recommendations: list[RecommendationOut]
