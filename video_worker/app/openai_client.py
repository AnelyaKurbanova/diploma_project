from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, List, Mapping, Optional

from openai import OpenAI

from .validators import ContentValidationError, PlanValidationError


class OpenAIClient:
    def __init__(self, api_key: str, model: str, timeout_seconds: int = 60) -> None:
        self._client = OpenAI(api_key=api_key, timeout=timeout_seconds)
        self._model = model

    async def generate_plan(self, request_json: Mapping[str, Any]) -> Dict[str, Any]:
        """Generate a scene plan JSON from the problem request."""

        return await asyncio.to_thread(self._generate_plan_sync, request_json)

    async def generate_content(
        self,
        request_json: Mapping[str, Any],
        plan_json: Mapping[str, Any],
        previous_errors: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Generate content JSON for all scenes in the given plan."""

        return await asyncio.to_thread(
            self._generate_content_sync, request_json, plan_json, previous_errors or []
        )

    # Internal synchronous helpers -----------------------------------------

    def _generate_plan_sync(self, request_json: Mapping[str, Any]) -> Dict[str, Any]:
        system_prompt = (
            "You are an expert math educator and video lesson designer. "
            "You design a short, clear scene plan for an educational math video "
            "using a fixed set of templates."
        )

        user_prompt = f"""
You will receive a JSON object describing a math video request:

REQUEST_JSON:
{json.dumps(request_json, ensure_ascii=False, indent=2)}

Your task:
- Design a sequence of scenes for a short educational video.
- Use ONLY templates from this allowlist: ["title", "goal", "definitions", "derivation", "plot", "summary"].
- The plan JSON MUST follow exactly this schema:

{{
  "scenes": [
    {{ "template": "title" }},
    {{ "template": "goal" }},
    {{ "template": "definitions" }},
    {{ "template": "derivation" }},
    {{ "template": "plot", "optional": true }},
    {{ "template": "summary" }}
  ]
}}

Rules:
- max scenes = 10.
- "plot" scene is optional; include it only if a simple graph (e.g., quadratic function) would help understanding.
- You MAY omit some of the non-plot templates if truly unnecessary, but keep the video coherent.
- Do NOT invent new template names.
- The order of scenes should tell a clear instructional story.

Output:
- Return ONLY valid JSON that follows the schema above.
- Do NOT include any explanations or markdown.

Short example (for illustration only, adapt to the actual request):
{{
  "scenes": [
    {{ "template": "title" }},
    {{ "template": "goal" }},
    {{ "template": "definitions" }},
    {{ "template": "derivation" }},
    {{ "template": "plot", "optional": true }},
    {{ "template": "summary" }}
  ]
}}
"""

        response = self._client.chat.completions.create(
            model=self._model,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        content = response.choices[0].message.content or "{}"
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            raise PlanValidationError(f"Invalid JSON from OpenAI: {exc}") from exc
        return data

    def _generate_content_sync(
        self,
        request_json: Mapping[str, Any],
        plan_json: Mapping[str, Any],
        previous_errors: List[str],
    ) -> Dict[str, Any]:
        system_prompt = (
            "You are an expert math educator and LaTeX writer. "
            "You produce concise, precise content for an educational math video, "
            "filling in data for a fixed set of scene templates."
        )

        error_block = ""
        if previous_errors:
            error_block = (
                "\nPrevious validation errors to fix:\n- "
                + "\n- ".join(previous_errors)
                + "\n"
            )

        user_prompt = f"""
You will receive:
1) The original REQUEST_JSON describing the math topic, difficulty, and problem.
2) A PLAN_JSON listing which scene templates to use and in what order.

REQUEST_JSON:
{json.dumps(request_json, ensure_ascii=False, indent=2)}

PLAN_JSON:
{json.dumps(plan_json, ensure_ascii=False, indent=2)}
{error_block}
Your task:
- Produce content for each scene in PLAN_JSON in a single JSON object.
- The output must follow exactly this schema:

{{
  "scenes": [
    {{ "template": "title", "data": {{ "title": "..." }} }},
    {{ "template": "goal", "data": {{ "text": "..." }} }},
    {{
      "template": "definitions",
      "data": {{
        "items": [{{ "label": "...", "value_latex": "..." }}]
      }}
    }},
    {{
      "template": "derivation",
      "data": {{
        "steps": ["latex_step_1", "latex_step_2", "..."]
      }}
    }},
    {{
      "template": "plot",
      "data": {{
        "a": 1,
        "b": -2,
        "c": -3,
        "x_min": -5,
        "x_max": 5
      }}
    }},
    {{
      "template": "summary",
      "data": {{
        "final_latex": "...",
        "text": "..."
      }}
    }}
  ]
}}

Constraints:
- Use ONLY templates that appear in PLAN_JSON, in the same order.
- max derivation steps = 12.
- max length of any string field = 160 characters.
- No empty strings; every string should be informative.
- LaTeX strings must be valid MathJax/LaTeX fragments (do not include surrounding $$ delimiters).
- For the plot scene (if present), choose simple numeric values:
  - a, b, c: small integers between -5 and 5.
  - x_min, x_max: integers with x_min < x_max, typically between -10 and 10.

Output:
- Return ONLY valid JSON that follows the schema above.
- Do NOT include explanations or markdown.

Short example (structure only, adapt to the actual plan and request):
{{
  "scenes": [
    {{ "template": "title", "data": {{ "title": "Solving a Quadratic Equation" }} }},
    {{ "template": "goal", "data": {{ "text": "Show how to solve a quadratic using the quadratic formula." }} }},
    {{
      "template": "definitions",
      "data": {{
        "items": [
          {{"label": "Quadratic equation", "value_latex": "ax^2 + bx + c = 0"}},
          {{"label": "Discriminant", "value_latex": "D = b^2 - 4ac"}}
        ]
      }}
    }},
    {{
      "template": "derivation",
      "data": {{
        "steps": [
          "ax^2 + bx + c = 0",
          "x = \\frac{{-b \\pm \\sqrt{{b^2 - 4ac}}}}{{2a}}"
        ]
      }}
    }},
    {{
      "template": "summary",
      "data": {{
        "final_latex": "x = \\frac{{-b \\pm \\sqrt{{b^2 - 4ac}}}}{{2a}}",
        "text": "We solved the quadratic equation using the quadratic formula."
      }}
    }}
  ]
}}
"""

        response = self._client.chat.completions.create(
            model=self._model,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        content = response.choices[0].message.content or "{}"
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ContentValidationError(f"Invalid JSON from OpenAI: {exc}") from exc
        return data

