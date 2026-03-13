from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.dashboard.application.service import DashboardService


class _SubjectsResult:
    def __init__(self, subjects):
        self._subjects = subjects

    def scalars(self):
        return self

    def all(self):
        return self._subjects


class _ScalarResult:
    def __init__(self, value: int):
        self._value = value

    def scalar_one(self):
        return self._value


@pytest.mark.asyncio
async def test_subjects_progress_uses_lesson_progress_instead_of_submissions():
    session = AsyncMock()
    service = DashboardService(session)

    subject = SimpleNamespace(id="subj-1", code="math", name_ru="Математика")
    seen_sql: list[str] = []

    responses = [
        _SubjectsResult([subject]),  # list subjects
        _ScalarResult(5),  # total topics
        _ScalarResult(2),  # completed topics
    ]

    async def execute_side_effect(stmt):
        seen_sql.append(str(stmt).lower())
        return responses.pop(0)

    session.execute.side_effect = execute_side_effect

    result = await service._get_subjects_progress(user_id="user-1")

    assert len(result) == 1
    assert result[0].completed_topics == 2
    assert result[0].total_topics == 5
    assert result[0].mastery == 40

    assert any("lesson_progress" in sql and "lessons" in sql for sql in seen_sql)
    assert not any("submissions" in sql and "problems" in sql for sql in seen_sql)
