from __future__ import annotations

PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "scenes": {
            "type": "array",
            "minItems": 1,
            "maxItems": 10,
            "items": {
                "type": "object",
                "properties": {
                    "template": {
                        "type": "string",
                        "enum": [
                            "title",
                            "goal",
                            "definitions",
                            "derivation",
                            "plot",
                            "summary",
                        ],
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
            "maxItems": 10,
            "items": {
                "type": "object",
                "properties": {
                    "template": {
                        "type": "string",
                        "enum": [
                            "title",
                            "goal",
                            "definitions",
                            "derivation",
                            "plot",
                            "summary",
                        ],
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

