from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Mapping

from jsonschema import Draft202012Validator

from .json_schemas import CONTENT_SCHEMA, PLAN_SCHEMA


ALLOWED_TEMPLATES = {
    "title",
    "goal",
    "definitions",
    "derivation",
    "plot",
    "summary",
    "hook",
    "recap",
    "key_point",
    "example",
    "step_by_step",
    "formula_build",
    "comparison",
    "warning",
    "quiz",
    "table",
    "number_line",
    "coordinate",
    "geometry",
    "fraction_visual",
    "transition",
}

MAX_STRING_LEN = 160
MAX_DERIVATION_STEPS = 10

REPEATABLE_TEMPLATES = {"derivation", "example", "quiz", "step_by_step", "transition", "key_point", "warning", "recap"}
MAX_REPEATS = 3

LATEX_IN_PLAIN_TEXT_PATTERN = re.compile(r"\\[a-zA-Z]+\s*(\{[^}]*\})?")


class PlanValidationError(Exception):
    pass


class ContentValidationError(Exception):
    pass


_plan_validator = Draft202012Validator(PLAN_SCHEMA)
_content_validator = Draft202012Validator(CONTENT_SCHEMA)


def _iter_strings(obj: Any) -> Iterable[str]:
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, Mapping):
        for value in obj.values():
            yield from _iter_strings(value)
    elif isinstance(obj, (list, tuple)):
        for item in obj:
            yield from _iter_strings(item)


def _validate_scene_order(templates: List[str]) -> None:
    """Flexible ordering rules: must start with title, end with summary, respect repeat limits."""
    if not templates:
        raise ContentValidationError("Content must have at least one scene")

    if templates[0] != "title":
        raise ContentValidationError("First scene must be 'title'")
    if templates[-1] != "summary":
        raise ContentValidationError("Last scene must be 'summary'")

    counts: Dict[str, int] = {}
    for t in templates:
        counts[t] = counts.get(t, 0) + 1

    if counts.get("title", 0) != 1:
        raise ContentValidationError("Content must contain exactly one 'title' scene")
    if counts.get("summary", 0) != 1:
        raise ContentValidationError("Content must contain exactly one 'summary' scene")

    for t, c in counts.items():
        if t in ("title", "summary"):
            continue
        if t not in REPEATABLE_TEMPLATES and c > 1:
            raise ContentValidationError(
                f"Template '{t}' may appear at most once, got {c}"
            )
        if t in REPEATABLE_TEMPLATES and c > MAX_REPEATS:
            raise ContentValidationError(
                f"Template '{t}' may appear at most {MAX_REPEATS} times, got {c}"
            )


def _assert_no_latex_in_plain_text(value: str, field_name: str) -> None:
    if not value or not isinstance(value, str):
        return
    if LATEX_IN_PLAIN_TEXT_PATTERN.search(value):
        raise ContentValidationError(
            f"Field '{field_name}' must be plain text without LaTeX commands (e.g. \\int, \\frac). "
            "Put formulas in dedicated LaTeX fields (value_latex, steps, final_latex)."
        )


def _validate_template_data(template: str, data: Mapping[str, Any], idx: int) -> None:
    """Per-template data validation."""

    if template == "title":
        if "title" not in data:
            raise ContentValidationError("Title scene requires 'title'")
    elif template == "goal":
        if "text" not in data:
            raise ContentValidationError("Goal scene requires 'text'")
    elif template == "definitions":
        items = data.get("items")
        if not isinstance(items, list) or not items:
            raise ContentValidationError("Definitions scene requires non-empty 'items' list")
        for item in items:
            if "label" not in item or "value_latex" not in item:
                raise ContentValidationError("Each definition item must have 'label' and 'value_latex'")
    elif template == "derivation":
        steps = data.get("steps")
        if not isinstance(steps, list) or not steps:
            raise ContentValidationError("Derivation scene requires non-empty 'steps' list")
        if len(steps) > MAX_DERIVATION_STEPS:
            raise ContentValidationError(
                f"Derivation scene may contain at most {MAX_DERIVATION_STEPS} steps"
            )
    elif template == "plot":
        if "func_code" in data:
            for key in ("func_code", "x_min", "x_max"):
                if key not in data:
                    raise ContentValidationError(f"Plot scene with func_code requires '{key}'")
            func_code = data.get("func_code", "")
            if not isinstance(func_code, str) or not func_code.strip():
                raise ContentValidationError("Plot scene 'func_code' must be a non-empty string")
            if len(func_code) > MAX_STRING_LEN:
                raise ContentValidationError(
                    f"Plot scene 'func_code' exceeds maximum length of {MAX_STRING_LEN}"
                )
        else:
            plot_type = data.get("plot_type", "quadratic")
            required = {"x_min", "x_max"}
            if plot_type == "linear":
                required |= {"slope", "intercept"}
            elif plot_type in ("sine", "cosine"):
                required |= {"amplitude", "frequency"}
            else:
                required |= {"a", "b", "c"}
            for key in required:
                if key not in data:
                    raise ContentValidationError(
                        f"Plot scene with plot_type={plot_type!r} requires '{key}'"
                    )
    elif template == "summary":
        if "final_latex" not in data or "text" not in data:
            raise ContentValidationError("Summary scene requires 'final_latex' and 'text'")
    elif template == "hook":
        if "text" not in data:
            raise ContentValidationError("Hook scene requires 'text'")
    elif template == "recap":
        items = data.get("items")
        if not isinstance(items, list) or not items:
            raise ContentValidationError("Recap scene requires non-empty 'items' list")
    elif template == "key_point":
        if "title" not in data or "formula_latex" not in data:
            raise ContentValidationError("Key point scene requires 'title' and 'formula_latex'")
    elif template == "example":
        if "problem" not in data:
            raise ContentValidationError("Example scene requires 'problem'")
        steps = data.get("steps")
        if not isinstance(steps, list) or not steps:
            raise ContentValidationError("Example scene requires non-empty 'steps' list")
    elif template == "step_by_step":
        if "title" not in data:
            raise ContentValidationError("Step-by-step scene requires 'title'")
        steps = data.get("steps")
        if not isinstance(steps, list) or not steps:
            raise ContentValidationError("Step-by-step scene requires non-empty 'steps' list")
    elif template == "formula_build":
        parts = data.get("parts")
        if not isinstance(parts, list) or not parts:
            raise ContentValidationError("Formula-build scene requires non-empty 'parts' list")
        for part in parts:
            if "latex" not in part:
                raise ContentValidationError("Each formula-build part must have 'latex'")
    elif template == "comparison":
        for key in ("left_title", "left_content", "right_title", "right_content"):
            if key not in data:
                raise ContentValidationError(f"Comparison scene requires '{key}'")
    elif template == "warning":
        for key in ("title", "wrong_latex", "correct_latex"):
            if key not in data:
                raise ContentValidationError(f"Warning scene requires '{key}'")
    elif template == "quiz":
        for key in ("question", "answer_latex"):
            if key not in data:
                raise ContentValidationError(f"Quiz scene requires '{key}'")
    elif template == "table":
        headers = data.get("headers")
        rows = data.get("rows")
        if not isinstance(headers, list) or not headers:
            raise ContentValidationError("Table scene requires non-empty 'headers' list")
        if not isinstance(rows, list) or not rows:
            raise ContentValidationError("Table scene requires non-empty 'rows' list")
    elif template == "number_line":
        for key in ("x_min", "x_max"):
            if key not in data:
                raise ContentValidationError(f"Number-line scene requires '{key}'")
    elif template == "coordinate":
        pass
    elif template == "geometry":
        if "shape" not in data:
            raise ContentValidationError("Geometry scene requires 'shape'")
    elif template == "fraction_visual":
        for key in ("numerator", "denominator"):
            if key not in data:
                raise ContentValidationError(f"Fraction-visual scene requires '{key}'")
    elif template == "transition":
        if "text" not in data:
            raise ContentValidationError("Transition scene requires 'text'")


_PLAIN_TEXT_FIELDS: Dict[str, List[str]] = {
    "title": ["title"],
    "goal": ["text"],
    "summary": ["text"],
    "hook": ["text"],
    "recap": [],
    "step_by_step": ["title"],
    "transition": ["text"],
    "comparison": ["left_title", "right_title"],
    "warning": ["title"],
    "quiz": ["question"],
    "key_point": ["title"],
    "example": ["problem"],
}


def validate_plan(plan: Mapping[str, Any]) -> Dict[str, Any]:
    errors = sorted(_plan_validator.iter_errors(plan), key=lambda e: e.path)
    if errors:
        msg = "; ".join(error.message for error in errors)
        raise PlanValidationError(msg)

    plan_dict = dict(plan)
    scenes = plan_dict.get("scenes") or []

    plot_count = 0
    for idx, scene in enumerate(scenes):
        template = scene.get("template")
        if template not in ALLOWED_TEMPLATES:
            raise PlanValidationError(f"Invalid template '{template}' at index {idx}")
        if template == "plot":
            plot_count += 1

    if plot_count > 1:
        raise PlanValidationError("Plan may contain at most one 'plot' scene")

    return plan_dict


def validate_content(
    content: Mapping[str, Any],
    plan: Mapping[str, Any] | None = None,
) -> Dict[str, Any]:
    errors = sorted(_content_validator.iter_errors(content), key=lambda e: e.path)
    if errors:
        msg = "; ".join(error.message for error in errors)
        raise ContentValidationError(msg)

    content_dict = dict(content)
    scenes: List[Mapping[str, Any]] = list(content_dict.get("scenes") or [])

    for idx, scene in enumerate(scenes):
        template = scene.get("template")
        data = scene.get("data") or {}

        if template not in ALLOWED_TEMPLATES:
            raise ContentValidationError(f"Invalid template '{template}' at index {idx}")

        _validate_template_data(template, data, idx)

    for scene in scenes:
        template = scene.get("template")
        data = scene.get("data") or {}
        plain_fields = _PLAIN_TEXT_FIELDS.get(template, [])
        for field in plain_fields:
            _assert_no_latex_in_plain_text(data.get(field, ""), f"{template}.data.{field}")

    templates_list = [s.get("template") for s in scenes]
    _validate_scene_order(templates_list)

    if plan is not None:
        plan_scenes = list(plan.get("scenes") or [])
        if len(plan_scenes) != len(scenes):
            raise ContentValidationError(
                "Content scenes length does not match plan scenes length"
            )
        for idx, (p, c) in enumerate(zip(plan_scenes, scenes, strict=False)):
            if p.get("template") != c.get("template"):
                raise ContentValidationError(
                    f"Template mismatch at index {idx}: "
                    f"plan='{p.get('template')}', content='{c.get('template')}'"
                )

    for s in _iter_strings(content_dict):
        if not s.strip():
            raise ContentValidationError("Empty strings are not allowed")
        if len(s) > MAX_STRING_LEN:
            raise ContentValidationError(
                f"String exceeds maximum length of {MAX_STRING_LEN} characters"
            )

    return content_dict
