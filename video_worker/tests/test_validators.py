from __future__ import annotations

import pytest

from video_worker.app.validators import (
    ContentValidationError,
    PlanValidationError,
    validate_content,
    validate_plan,
)


def test_validate_plan_valid() -> None:
    plan = {
        "scenes": [
            {"template": "title"},
            {"template": "goal"},
            {"template": "definitions"},
            {"template": "derivation"},
            {"template": "plot", "optional": True},
            {"template": "summary"},
        ]
    }
    validated = validate_plan(plan)
    assert validated["scenes"][0]["template"] == "title"


def test_validate_plan_disallows_multiple_plots() -> None:
    plan = {
        "scenes": [
            {"template": "plot"},
            {"template": "plot"},
        ]
    }
    with pytest.raises(PlanValidationError):
        validate_plan(plan)


def test_validate_content_valid() -> None:
    """Valid content has 6 or 7 scenes in strict order: title, goal, definitions, derivation, plot, [derivation], summary."""
    plan = {
        "scenes": [
            {"template": "title"},
            {"template": "goal"},
            {"template": "definitions"},
            {"template": "derivation"},
            {"template": "plot"},
            {"template": "summary"},
        ]
    }
    content = {
        "scenes": [
            {"template": "title", "data": {"title": "Sample Title"}},
            {"template": "goal", "data": {"text": "Explain a simple concept."}},
            {
                "template": "definitions",
                "data": {
                    "items": [
                        {"label": "Idea", "value_latex": "x^2"},
                    ]
                },
            },
            {"template": "derivation", "data": {"steps": ["a", "b"]}},
            {
                "template": "plot",
                "data": {"func_code": "lambda x: x**2", "x_min": -3, "x_max": 3},
            },
            {
                "template": "summary",
                "data": {
                    "final_latex": "x = 1",
                    "text": "We saw that x equals one.",
                },
            },
        ]
    }
    validated = validate_content(content, plan=plan)
    assert len(validated["scenes"]) == 6


def test_validate_content_rejects_invalid_template() -> None:
    content = {
        "scenes": [
            {"template": "unknown", "data": {"title": "X"}},
        ]
    }
    with pytest.raises(ContentValidationError):
        validate_content(content)


def test_validate_content_limits_string_length() -> None:
    long_text = "x" * 200
    content = {
        "scenes": [
            {"template": "title", "data": {"title": long_text}},
        ]
    }
    with pytest.raises(ContentValidationError):
        validate_content(content)


def test_validate_content_limits_derivation_steps() -> None:
    steps = [f"step_{i}" for i in range(20)]
    content = {
        "scenes": [
            {"template": "derivation", "data": {"steps": steps}},
        ]
    }
    with pytest.raises(ContentValidationError):
        validate_content(content)


def test_validate_content_rejects_empty_strings() -> None:
    content = {
        "scenes": [
            {"template": "goal", "data": {"text": " "}},
        ]
    }
    with pytest.raises(ContentValidationError):
        validate_content(content)


def test_validate_content_valid_seven_scenes() -> None:
    """Valid content with 7 scenes (two derivation blocks) passes."""
    content = {
        "scenes": [
            {"template": "title", "data": {"title": "Topic"}},
            {"template": "goal", "data": {"text": "Goal text."}},
            {
                "template": "definitions",
                "data": {"items": [{"label": "X", "value_latex": "1"}]},
            },
            {"template": "derivation", "data": {"steps": ["a", "b"]}},
            {
                "template": "plot",
                "data": {"func_code": "lambda x: math.sin(x)", "x_min": -5, "x_max": 5},
            },
            {"template": "derivation", "data": {"steps": ["Example step.", "Answer."]}},
            {
                "template": "summary",
                "data": {"final_latex": "y = 1", "text": "Summary."},
            },
        ]
    }
    validated = validate_content(content)
    assert len(validated["scenes"]) == 7


def test_validate_content_rejects_latex_in_plain_text() -> None:
    """Title, goal.text and summary.text must not contain LaTeX commands."""
    base = {
        "scenes": [
            {"template": "title", "data": {"title": "OK title"}},
            {"template": "goal", "data": {"text": "Goal."}},
            {
                "template": "definitions",
                "data": {"items": [{"label": "L", "value_latex": "x^2"}]},
            },
            {"template": "derivation", "data": {"steps": ["a"]}},
            {"template": "plot", "data": {"func_code": "lambda x: x", "x_min": -1, "x_max": 1}},
            {"template": "summary", "data": {"final_latex": "1", "text": "Done."}},
        ]
    }
    validated = validate_content(base)
    assert len(validated["scenes"]) == 6

    bad_title = dict(base)
    bad_title["scenes"] = [{**base["scenes"][0], "data": {"title": "Formula \\int f"}}] + base["scenes"][1:]
    with pytest.raises(ContentValidationError, match="plain text without LaTeX"):
        validate_content(bad_title)

