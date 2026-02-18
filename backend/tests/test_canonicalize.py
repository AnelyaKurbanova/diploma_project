"""Unit tests for the answer canonicalization module."""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock

from app.modules.problems.application.canonicalize import (
    normalize_for_storage,
    answers_match,
)
from app.modules.submissions.application.service import SubmissionService


def _make_answer_key(
    *,
    text_answer: str | None = None,
    canonical_answer: str | None = None,
    numeric_answer: float | None = None,
    tolerance: float | None = None,
    answer_pattern: str | None = None,
) -> MagicMock:
    ak = MagicMock()
    ak.text_answer = text_answer
    ak.canonical_answer = canonical_answer
    ak.numeric_answer = numeric_answer
    ak.tolerance = tolerance
    ak.answer_pattern = answer_pattern
    return ak


class TestNormalizeForStorage:
    """Test the deterministic canonicalization function."""

    # ── Numbers with units (speed) ───────────────────────────────
    def test_kmh_cyrillic_no_space(self):
        assert normalize_for_storage("36км/ч") == "36 km/h"

    def test_kmh_cyrillic_with_space(self):
        assert normalize_for_storage("36 км/ч") == "36 km/h"

    def test_kmh_latin(self):
        assert normalize_for_storage("36 km/h") == "36 km/h"

    def test_kmh_latin_hour(self):
        assert normalize_for_storage("36 km/hour") == "36 km/h"

    def test_ms_cyrillic(self):
        assert normalize_for_storage("12 м/с") == "12 m/s"

    def test_ms_latin(self):
        assert normalize_for_storage("12 m/s") == "12 m/s"

    # ── Numbers with units (other) ───────────────────────────────
    def test_kg(self):
        assert normalize_for_storage("5кг") == "5 kg"

    def test_newtons(self):
        assert normalize_for_storage("10 н") == "10 N"

    def test_joules(self):
        assert normalize_for_storage("100дж") == "100 J"

    def test_watts(self):
        assert normalize_for_storage("500 вт") == "500 W"

    def test_meters(self):
        assert normalize_for_storage("15м") == "15 m"

    def test_centimeters(self):
        assert normalize_for_storage("30 см") == "30 cm"

    def test_degrees(self):
        assert normalize_for_storage("90°") == "90 °"

    def test_square_meters(self):
        assert normalize_for_storage("25 м²") == "25 m^2"

    def test_liters(self):
        assert normalize_for_storage("3л") == "3 L"

    # ── Pure numbers ─────────────────────────────────────────────
    def test_integer(self):
        assert normalize_for_storage("42") == "42"

    def test_float_dot(self):
        assert normalize_for_storage("3.14") == "3.14"

    def test_float_comma(self):
        assert normalize_for_storage("3,14") == "3.14"

    def test_negative(self):
        assert normalize_for_storage("-7") == "-7"

    def test_negative_float(self):
        assert normalize_for_storage("-3.5") == "-3.5"

    def test_trailing_zero_removed(self):
        assert normalize_for_storage("36.0") == "36"

    def test_fraction(self):
        assert normalize_for_storage("3/5") == "0.6"

    def test_fraction_integer_result(self):
        assert normalize_for_storage("10/5") == "2"

    # ── Text answers ─────────────────────────────────────────────
    def test_text_lowercase_and_trim(self):
        assert normalize_for_storage("   Пифагоров теорема  ") == "пифагоров теорема"

    def test_text_collapse_spaces(self):
        assert normalize_for_storage("пифагоров    теорема") == "пифагоров теорема"

    def test_text_mixed_case(self):
        assert normalize_for_storage("ВОДА") == "вода"

    def test_text_strip_edge_punctuation(self):
        assert normalize_for_storage("...ответ!!!") == "ответ"

    # ── Unicode handling ─────────────────────────────────────────
    def test_unicode_minus(self):
        assert normalize_for_storage("\u22125") == "-5"

    def test_nbsp_handling(self):
        assert normalize_for_storage("36\u00a0км/ч") == "36 km/h"

    # ── Edge cases ───────────────────────────────────────────────
    def test_empty_string(self):
        assert normalize_for_storage("") is None

    def test_whitespace_only(self):
        assert normalize_for_storage("   ") is None

    def test_none_safe(self):
        assert normalize_for_storage("") is None


class TestAnswersMatch:
    def test_same_canonical(self):
        assert answers_match("36 km/h", "36 km/h") is True

    def test_different_canonical(self):
        assert answers_match("36 km/h", "35 km/h") is False


class TestCanonicalAnswerInGrading:
    """Test that canonical_answer field is used in deterministic_text_check."""

    def setup_method(self):
        self.svc = SubmissionService(session=MagicMock())

    def test_canonical_match_36kmh_variants(self):
        """Creator stored '36км/ч' → canonical '36 km/h'.
        Student enters '36 km/h' → canonical '36 km/h' → match!"""
        ak = _make_answer_key(
            text_answer="36км/ч",
            canonical_answer="36 km/h",
        )
        ok, score, debug = self.svc._deterministic_text_check("36 km/h", ak, 10)
        assert ok is True
        assert score == 10
        assert debug["kind"] == "canonical_match"

    def test_canonical_match_cyrillic_student(self):
        """Student enters '36 км/ч' → canonical '36 km/h' matches stored."""
        ak = _make_answer_key(
            text_answer="36км/ч",
            canonical_answer="36 km/h",
        )
        ok, score, debug = self.svc._deterministic_text_check("36 км/ч", ak, 10)
        assert ok is True
        assert score == 10

    def test_canonical_no_match_different_value(self):
        """Student enters '35 km/h' → different from '36 km/h'."""
        ak = _make_answer_key(
            text_answer="36км/ч",
            canonical_answer="36 km/h",
        )
        ok, score, debug = self.svc._deterministic_text_check("35 km/h", ak, 10)
        assert ok is False
        assert score == 0

    def test_text_answer_exact_match_takes_precedence(self):
        """If text_answer itself matches (case-insensitive), that takes priority."""
        ak = _make_answer_key(
            text_answer="Пифагор",
            canonical_answer="пифагор",
        )
        ok, score, debug = self.svc._deterministic_text_check("пифагор", ak, 5)
        assert ok is True
        assert score == 5
        assert debug["kind"] == "text_equal"

    def test_canonical_match_for_text_answer_with_spaces(self):
        """Creator: 'Пифагоров теорема', canonical: 'пифагоров теорема'.
        Student: '  пифагоров  теорема  ' → canonical: 'пифагоров теорема' → match."""
        ak = _make_answer_key(
            text_answer="Пифагоров теорема",
            canonical_answer="пифагоров теорема",
        )
        ok, score, debug = self.svc._deterministic_text_check("  пифагоров  теорема  ", ak, 5)
        assert ok is True
        assert score == 5

    def test_canonical_match_kg_unit(self):
        """'5кг' canonical → '5 kg'. Student '5 kg' should match."""
        ak = _make_answer_key(
            text_answer="5кг",
            canonical_answer="5 kg",
        )
        ok, score, debug = self.svc._deterministic_text_check("5 kg", ak, 5)
        assert ok is True
        assert score == 5
        assert debug["kind"] == "canonical_match"
