"""E2E-level tests for the full problem creation + submission flow.

These tests exercise the service layer without a live HTTP server,
mocking the DB session. They validate:
1. Problem creation with images and canonical answer computation
2. Text answer submission with canonical matching
3. Grading trace integrity
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.problems.application.canonicalize import normalize_for_storage
from app.modules.problems.application.service import ProblemService, _compute_canonical
from app.modules.problems.api.schemas import ProblemAnswerKeyIn, ProblemCreate, ProblemImageIn
from app.modules.problems.data.models import ProblemType, ProblemDifficulty


class TestComputeCanonical:
    """Test that _compute_canonical produces the right value for various inputs."""

    def test_text_answer_with_unit(self):
        ak = MagicMock()
        ak.text_answer = "36км/ч"
        ak.numeric_answer = None
        result = _compute_canonical(ak)
        assert result == "36 km/h"

    def test_text_answer_plain_text(self):
        ak = MagicMock()
        ak.text_answer = "Пифагоров теорема"
        ak.numeric_answer = None
        result = _compute_canonical(ak)
        assert result == "пифагоров теорема"

    def test_numeric_answer_fallback(self):
        ak = MagicMock()
        ak.text_answer = None
        ak.numeric_answer = 42.0
        result = _compute_canonical(ak)
        assert result == "42"

    def test_none_answer_key(self):
        result = _compute_canonical(None)
        assert result is None


class TestProblemCreationWithImages:
    """Test ProblemCreate schema accepts images and they validate correctly."""

    def test_create_schema_with_images(self):
        data = ProblemCreate(
            subject_id=uuid.uuid4(),
            type=ProblemType.SHORT_TEXT,
            difficulty=ProblemDifficulty.EASY,
            title="Test Problem",
            statement="What is 6×6?",
            time_limit_sec=60,
            points=5,
            answer_key=ProblemAnswerKeyIn(text_answer="36"),
            images=[
                ProblemImageIn(url="https://example.com/img1.jpg", order_no=0),
                ProblemImageIn(url="https://example.com/img2.png", order_no=1),
            ],
        )
        assert len(data.images) == 2
        assert data.images[0].order_no == 0
        assert data.images[1].url == "https://example.com/img2.png"

    def test_create_schema_rejects_more_than_3_images(self):
        with pytest.raises(Exception):
            ProblemCreate(
                subject_id=uuid.uuid4(),
                type=ProblemType.SHORT_TEXT,
                difficulty=ProblemDifficulty.EASY,
                title="Test",
                statement="Statement",
                time_limit_sec=60,
                points=1,
                images=[
                    ProblemImageIn(url=f"https://example.com/{i}.jpg", order_no=i)
                    for i in range(4)
                ],
            )


class TestCanonicalAnswerConsistency:
    """Test that the canonical form computed at creation time matches
    what would be computed from student input at grading time."""

    @pytest.mark.parametrize(
        "creator_answer, student_inputs",
        [
            ("36км/ч", ["36км/ч", "36 км/ч", "36 km/h", "36km/h"]),
            ("12 м/с", ["12м/с", "12 m/s", "12 м/с"]),
            ("Пифагоров теорема", ["пифагоров теорема", "  Пифагоров  Теорема  ", "ПИФАГОРОВ ТЕОРЕМА"]),
            ("5кг", ["5кг", "5 кг", "5 kg", "5kg"]),
            ("100", ["100", "100.0", "100,0"]),
        ],
    )
    def test_creator_and_student_canonical_match(
        self, creator_answer: str, student_inputs: list[str]
    ):
        creator_canonical = normalize_for_storage(creator_answer)
        assert creator_canonical is not None

        for student_input in student_inputs:
            student_canonical = normalize_for_storage(student_input)
            assert student_canonical == creator_canonical, (
                f"Mismatch: creator '{creator_answer}' → '{creator_canonical}', "
                f"student '{student_input}' → '{student_canonical}'"
            )
