
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.submissions.application.service import (
    SubmissionService,
    _try_parse_number,
)


def _make_answer_key(
    *,
    numeric_answer: float | None = None,
    tolerance: float | None = None,
    text_answer: str | None = None,
    answer_pattern: str | None = None,
    canonical_answer: str | None = None,
) -> MagicMock:
    ak = MagicMock()
    ak.numeric_answer = numeric_answer
    ak.tolerance = tolerance
    ak.text_answer = text_answer
    ak.answer_pattern = answer_pattern
    ak.canonical_answer = canonical_answer
    return ak


def _make_service() -> SubmissionService:
    return SubmissionService(session=MagicMock())


class TestTryParseNumber:
    def test_integer(self):
        assert _try_parse_number("42") == 42.0

    def test_float_dot(self):
        assert _try_parse_number("3.14") == pytest.approx(3.14)

    def test_float_comma(self):
        assert _try_parse_number("3,14") == pytest.approx(3.14)

    def test_negative(self):
        assert _try_parse_number("-7") == -7.0

    def test_fraction(self):
        assert _try_parse_number("3/5") == pytest.approx(0.6)

    def test_fraction_with_spaces(self):
        assert _try_parse_number("3 / 5") == pytest.approx(0.6)

    def test_scientific(self):
        assert _try_parse_number("1.5e3") == pytest.approx(1500.0)

    def test_non_numeric(self):
        assert _try_parse_number("hello") is None

    def test_empty(self):
        assert _try_parse_number("") is None

    def test_unicode_minus(self):
        assert _try_parse_number("\u2212" + "5") == pytest.approx(-5.0)

    def test_thousands_separator(self):
        assert _try_parse_number("1 000") == pytest.approx(1000.0)


class TestDeterministicTextCheck:
    def setup_method(self):
        self.svc = _make_service()

    def test_exact_text_match(self):
        ak = _make_answer_key(text_answer="Paris")
        ok, score, debug = self.svc._deterministic_text_check("paris", ak, 10)
        assert ok is True
        assert score == 10
        assert debug["kind"] == "text_equal"

    def test_exact_text_mismatch(self):
        ak = _make_answer_key(text_answer="Paris")
        ok, score, debug = self.svc._deterministic_text_check("London", ak, 10)
        assert ok is False
        assert score == 0
        assert debug["kind"] == "text_mismatch"

    def test_numeric_exact(self):
        ak = _make_answer_key(numeric_answer=36.0, tolerance=0.0)
        ok, score, debug = self.svc._deterministic_text_check("36", ak, 5)
        assert ok is True
        assert score == 5
        assert debug["kind"] == "numeric_with_tolerance"

    def test_numeric_with_tolerance(self):
        ak = _make_answer_key(numeric_answer=36.0, tolerance=0.5)
        ok, score, debug = self.svc._deterministic_text_check("36.3", ak, 5)
        assert ok is True
        assert score == 5
        assert debug["kind"] == "numeric_with_tolerance"

    def test_numeric_outside_tolerance(self):
        ak = _make_answer_key(numeric_answer=36.0, tolerance=0.5)
        ok, score, debug = self.svc._deterministic_text_check("37", ak, 5)
        assert ok is False
        assert score == 0
        assert debug["kind"] == "numeric_with_tolerance"

    def test_numeric_unparseable_returns_none(self):
        ak = _make_answer_key(numeric_answer=36.0, tolerance=0.0)
        ok, score, debug = self.svc._deterministic_text_check("тридцать шесть", ak, 5)
        assert ok is None
        assert score is None
        assert debug["kind"] == "numeric_parse_failed"

    def test_fraction_answer(self):
        ak = _make_answer_key(numeric_answer=0.6, tolerance=0.001)
        ok, score, debug = self.svc._deterministic_text_check("3/5", ak, 5)
        assert ok is True
        assert score == 5
        assert debug["kind"] == "numeric_with_tolerance"

    def test_regex_pattern_match(self):
        ak = _make_answer_key(answer_pattern=r"\d+\s*(km/h|м/с)")
        ok, score, debug = self.svc._deterministic_text_check("36 km/h", ak, 5)
        assert ok is True
        assert score == 5
        assert debug["kind"] == "pattern_fullmatch"

    def test_regex_pattern_no_match(self):
        ak = _make_answer_key(answer_pattern=r"\d+\s*km/h")
        ok, score, debug = self.svc._deterministic_text_check("fast", ak, 5)
        assert ok is False
        assert score == 0
        assert debug["kind"] == "pattern_fullmatch"

    def test_empty_answer_returns_none(self):
        ak = _make_answer_key(text_answer="anything")
        ok, score, debug = self.svc._deterministic_text_check("", ak, 5)
        assert ok is None
        assert score is None
        assert debug["kind"] == "empty"

    def test_comma_decimal(self):
        ak = _make_answer_key(numeric_answer=3.14, tolerance=0.01)
        ok, score, debug = self.svc._deterministic_text_check("3,14", ak, 5)
        assert ok is True
        assert score == 5
        assert debug["kind"] == "numeric_with_tolerance"


class TestLLMFallbackPipeline:
    @pytest.mark.asyncio
    async def test_llm_normalizes_and_second_check_passes(self):
        svc = _make_service()

        ak = _make_answer_key(numeric_answer=36.0, tolerance=0.0)

        ok1, _, _ = svc._deterministic_text_check("тридцать шесть", ak, 5)
        assert ok1 is None

        with patch(
            "app.modules.submissions.application.llm_normalizer.normalize_answer_via_llm",
            new_callable=AsyncMock,
            return_value="36",
        ):
            from app.modules.submissions.application.llm_normalizer import (
                normalize_answer_via_llm,
            )
            normalized = await normalize_answer_via_llm("тридцать шесть")

        ok2, score2, _ = svc._deterministic_text_check(normalized, ak, 5)
        assert ok2 is True
        assert score2 == 5

    @pytest.mark.asyncio
    async def test_llm_normalizes_but_still_wrong(self):
        svc = _make_service()

        ak = _make_answer_key(numeric_answer=36.0, tolerance=0.0)

        with patch(
            "app.modules.submissions.application.llm_normalizer.normalize_answer_via_llm",
            new_callable=AsyncMock,
            return_value="42",
        ):
            from app.modules.submissions.application.llm_normalizer import (
                normalize_answer_via_llm,
            )
            normalized = await normalize_answer_via_llm("сорок два")

        ok, score, _ = svc._deterministic_text_check(normalized, ak, 5)
        assert ok is False
        assert score == 0

    @pytest.mark.asyncio
    async def test_llm_returns_none_stays_incorrect(self):
        svc = _make_service()

        ak = _make_answer_key(numeric_answer=36.0, tolerance=0.0)
        ok1, _, _ = svc._deterministic_text_check("gibberish", ak, 5)
        assert ok1 is None

        with patch(
            "app.modules.submissions.application.llm_normalizer.normalize_answer_via_llm",
            new_callable=AsyncMock,
            return_value=None,
        ):
            from app.modules.submissions.application.llm_normalizer import (
                normalize_answer_via_llm,
            )
            normalized = await normalize_answer_via_llm("gibberish")

        assert normalized is None
