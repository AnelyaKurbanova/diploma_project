from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Mapping

from jsonschema import Draft202012Validator

from .json_schemas import CONTENT_SCHEMA, PLAN_SCHEMA


ALLOWED_TEMPLATES = {"title", "goal", "definitions", "derivation", "plot", "summary"}
MAX_STRING_LEN = 160
# Ограничиваем количество шагов вывода в одной сцене, чтобы формулы не превращались в «простыню».
MAX_DERIVATION_STEPS = 8

# Expected scene order: title, goal, definitions, derivation, plot, [derivation], summary
REQUIRED_SCENE_ORDER = ["title", "goal", "definitions", "derivation", "plot", "summary"]
# LaTeX backslash pattern: plain-text fields must not contain raw LaTeX commands
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
    """Ensure exactly one title, goal, definitions, plot, summary; 1 or 2 derivations; correct order."""
    required_single = {"title", "goal", "definitions", "plot", "summary"}
    counts: Dict[str, int] = {}
    for t in templates:
        counts[t] = counts.get(t, 0) + 1

    for name in required_single:
        if counts.get(name) != 1:
            raise ContentValidationError(
                f"Content must contain exactly one '{name}' scene, got {counts.get(name, 0)}"
            )
    derivation_count = counts.get("derivation", 0)
    if derivation_count < 1 or derivation_count > 2:
        raise ContentValidationError(
            f"Content must contain 1 or 2 'derivation' scenes, got {derivation_count}"
        )

    # Expected order: title, goal, definitions, derivation, plot, [derivation], summary
    if derivation_count == 1:
        expected = ["title", "goal", "definitions", "derivation", "plot", "summary"]
    else:
        expected = [
            "title",
            "goal",
            "definitions",
            "derivation",
            "plot",
            "derivation",
            "summary",
        ]
    if templates != expected:
        raise ContentValidationError(
            f"Scenes must follow order: {expected}; got order: {templates}"
        )


def _assert_no_latex_in_plain_text(value: str, field_name: str) -> None:
    """Raise if value contains LaTeX backslash commands (plain-text fields must be Russian only)."""
    if not value or not isinstance(value, str):
        return
    if LATEX_IN_PLAIN_TEXT_PATTERN.search(value):
        raise ContentValidationError(
            f"Field '{field_name}' must be plain text without LaTeX commands (e.g. \\int, \\frac). "
            "Put formulas in dedicated LaTeX fields (value_latex, steps, final_latex)."
        )


def validate_plan(plan: Mapping[str, Any]) -> Dict[str, Any]:
    errors = sorted(_plan_validator.iter_errors(plan), key=lambda e: e.path)
    if errors:
        msg = "; ".join(error.message for error in errors)
        raise PlanValidationError(msg)

    plan_dict = dict(plan)
    scenes = plan_dict.get("scenes") or []

    # Custom: templates in allowlist and at most one plot scene.
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

    # Custom: enforce template allowlist and per-template structure.
    for idx, scene in enumerate(scenes):
        template = scene.get("template")
        data = scene.get("data") or {}

        if template not in ALLOWED_TEMPLATES:
            raise ContentValidationError(f"Invalid template '{template}' at index {idx}")

        if template == "title":
            if "title" not in data:
                raise ContentValidationError("Title scene requires 'title'")
        elif template == "goal":
            if "text" not in data:
                raise ContentValidationError("Goal scene requires 'text'")
        elif template == "definitions":
            items = data.get("items")
            if not isinstance(items, list) or not items:
                raise ContentValidationError(
                    "Definitions scene requires non-empty 'items' list"
                )
            for item in items:
                if "label" not in item or "value_latex" not in item:
                    raise ContentValidationError(
                        "Each definition item must have 'label' and 'value_latex'"
                    )
        elif template == "derivation":
            steps = data.get("steps")
            if not isinstance(steps, list) or not steps:
                raise ContentValidationError(
                    "Derivation scene requires non-empty 'steps' list"
                )
            if len(steps) > MAX_DERIVATION_STEPS:
                raise ContentValidationError(
                    f"Derivation scene may contain at most {MAX_DERIVATION_STEPS} steps"
                )
        elif template == "plot":
            if "func_code" in data:
                # New contract: func_code + x_min, x_max
                for key in ("func_code", "x_min", "x_max"):
                    if key not in data:
                        raise ContentValidationError(
                            f"Plot scene with func_code requires '{key}'"
                        )
                func_code = data.get("func_code", "")
                if not isinstance(func_code, str) or not func_code.strip():
                    raise ContentValidationError(
                        "Plot scene 'func_code' must be a non-empty string"
                    )
                if len(func_code) > MAX_STRING_LEN:
                    raise ContentValidationError(
                        f"Plot scene 'func_code' exceeds maximum length of {MAX_STRING_LEN}"
                    )
            else:
                # Legacy: plot_type + numeric params
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

    # Plain-text fields must not contain LaTeX commands.
    for scene in scenes:
        template = scene.get("template")
        data = scene.get("data") or {}
        if template == "title":
            _assert_no_latex_in_plain_text(
                data.get("title", ""), "title.data.title"
            )
        elif template == "goal":
            _assert_no_latex_in_plain_text(data.get("text", ""), "goal.data.text")
        elif template == "summary":
            _assert_no_latex_in_plain_text(
                data.get("text", ""), "summary.data.text"
            )

    # Enforce scene order and counts: exactly one of each single, 1 or 2 derivations.
    templates_list = [s.get("template") for s in scenes]
    _validate_scene_order(templates_list)

    # Custom: ensure content matches plan templates when plan provided.
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

    # Custom: enforce string length and non-empty constraints across payload.
    for s in _iter_strings(content_dict):
        if not s.strip():
            raise ContentValidationError("Empty strings are not allowed")
        if len(s) > MAX_STRING_LEN:
            raise ContentValidationError(
                f"String exceeds maximum length of {MAX_STRING_LEN} characters"
            )

    return content_dict

