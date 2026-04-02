from __future__ import annotations

_ALL_TEMPLATES = [
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
]

PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "scenes": {
            "type": "array",
            "minItems": 1,
            "maxItems": 15,
            "items": {
                "type": "object",
                "properties": {
                    "template": {
                        "type": "string",
                        "enum": _ALL_TEMPLATES,
                    },
                    "optional": {"type": "boolean"},
                },
                "required": ["template"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["scenes"],
    "additionalProperties": False,
}


CONTENT_SCHEMA = {
    "type": "object",
    "properties": {
        "scenes": {
            "type": "array",
            "minItems": 1,
            "maxItems": 15,
            "items": {
                "type": "object",
                "properties": {
                    "template": {
                        "type": "string",
                        "enum": _ALL_TEMPLATES,
                    },
                    "data": {"type": "object"},
                },
                "required": ["template", "data"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["scenes"],
    "additionalProperties": False,
}
