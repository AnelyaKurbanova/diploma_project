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
            "Ты — опытный педагог-методист по математике и дизайнер видеоуроков. "
            "Ты проектируешь структуру короткого обучающего видео для школьников, "
            "используя набор готовых шаблонов сцен. Твоя цель — сделать урок максимально понятным "
            "даже для самых слабых учеников. Каждая сцена должна нести одну простую идею."
        )

        user_prompt = f"""
Получи JSON-объект с описанием запроса на математическое видео:

REQUEST_JSON:
{json.dumps(request_json, ensure_ascii=False, indent=2)}

Твоя задача — спроектировать последовательность сцен для обучающего видео.

ДОСТУПНЫЕ ШАБЛОНЫ (21 штука):
- "title"           — Титульный экран с названием темы
- "hook"            — Привлечение внимания: интересный вопрос или факт
- "goal"            — Цель урока: что ученик узнает
- "recap"           — Повторение: что нужно знать перед этой темой
- "definitions"     — Определения: ключевые термины с формулами
- "key_point"       — Ключевое правило: одна важная формула/правило в рамке
- "derivation"      — Вывод формулы: пошаговое преобразование формул
- "formula_build"   — Построение формулы по частям с пояснениями
- "example"         — Разбор примера: задача + пошаговое решение
- "step_by_step"    — Алгоритм: пронумерованные шаги решения
- "plot"            — График функции (квадратичная, линейная, тригонометрическая)
- "number_line"     — Числовая прямая с отмеченными точками и интервалами
- "coordinate"      — Координатная плоскость с точками и векторами
- "geometry"        — Геометрические фигуры с размерами (треугольник, прямоугольник, круг)
- "fraction_visual" — Наглядное представление дробей (закрашенные прямоугольники)
- "table"           — Таблица данных
- "comparison"      — Сравнение двух подходов / правильно vs неправильно
- "warning"         — Частая ошибка: что делают неправильно и как правильно
- "quiz"            — Мини-задание: вопрос + пауза + ответ
- "transition"      — Переход между разделами
- "summary"         — Итог: главная формула + краткий вывод

ТИПЫ УРОКОВ (выбери подходящий и адаптируй):

1) Введение нового понятия:
   title → hook → goal → definitions → key_point → example → quiz → summary

2) Решение задач:
   title → hook → goal → recap → step_by_step → example → warning → quiz → summary

3) Вывод формулы:
   title → goal → definitions → formula_build → derivation → example → summary

4) Наглядная математика (геометрия, дроби, графики):
   title → hook → goal → definitions → geometry/fraction_visual/plot → example → summary

5) Повторение и практика:
   title → goal → recap → quiz → example → warning → quiz → summary

6) Сравнение методов:
   title → goal → recap → comparison → example → example → summary

ПРАВИЛА:
- Первая сцена ВСЕГДА "title", последняя ВСЕГДА "summary".
- Максимум 15 сцен.
- "plot" — максимум 1 раз.
- "derivation", "example", "quiz", "step_by_step", "transition", "key_point", "warning", "recap" могут повторяться до 3 раз.
- Остальные шаблоны — максимум 1 раз.
- Структура должна рассказывать связную историю: от простого к сложному.
- Используй "hook" чтобы заинтересовать ученика в начале.
- Используй "warning" чтобы показать типичные ошибки.
- Используй "quiz" чтобы ученик активно думал.
- Выбирай шаблоны ИСХОДЯ ИЗ ТЕМЫ. Не используй геометрию для алгебры, и наоборот.

ФОРМАТ ОТВЕТА:
Верни ТОЛЬКО валидный JSON (без markdown):
{{
  "scenes": [
    {{ "template": "title" }},
    {{ "template": "hook" }},
    ...
    {{ "template": "summary" }}
  ]
}}
"""

        response = self._client.chat.completions.create(
            model=self._model,
            temperature=0.3,
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
            "Ты — опытный учитель математики и эксперт по LaTeX. "
            "Ты создаёшь контент для обучающего видео, заполняя данные для каждой сцены. "
            "Твоя целевая аудитория — школьники 10-16 лет, включая самых слабых учеников. "
            "ПЕДАГОГИЧЕСКИЕ ПРИНЦИПЫ:\n"
            "- Объясняй как 12-летнему ребёнку.\n"
            "- Используй простые бытовые аналогии.\n"
            "- Разбивай сложные идеи на крошечные шаги.\n"
            "- Каждая формула должна быть объяснена словами.\n"
            "- Выделяй ОДИН самый важный вывод.\n"
            "- Все текстовые поля — на русском языке.\n"
            "- LaTeX пиши без окружающих $$ — только формульный код."
        )

        error_block = ""
        if previous_errors:
            error_block = (
                "\nОшибки валидации, которые нужно исправить:\n- "
                + "\n- ".join(previous_errors)
                + "\n"
            )

        user_prompt = f"""
REQUEST_JSON:
{json.dumps(request_json, ensure_ascii=False, indent=2)}

PLAN_JSON:
{json.dumps(plan_json, ensure_ascii=False, indent=2)}
{error_block}

Заполни данные для каждой сцены из PLAN_JSON.

СХЕМЫ ДАННЫХ ДЛЯ КАЖДОГО ШАБЛОНА:

1) "title" → {{ "title": "Название темы (без LaTeX, русский текст)" }}

2) "hook" → {{ "text": "Интересный вопрос или факт (без LaTeX)" }}

3) "goal" → {{ "text": "Что ученик узнает (без LaTeX)" }}

4) "recap" → {{ "items": ["Факт 1", "Факт 2", ...] }}
   (список предпосылок, 2-5 пунктов)

5) "definitions" → {{
     "items": [
       {{ "label": "Название термина", "value_latex": "формула в LaTeX" }},
       ...
     ]
   }}

6) "key_point" → {{
     "title": "Название правила (без LaTeX)",
     "formula_latex": "главная формула в LaTeX",
     "explanation": "пояснение простыми словами (без LaTeX, необязательно)"
   }}

7) "derivation" → {{ "steps": ["шаг1_latex", "шаг2_latex", ...] }}
   (максимум 10 шагов, каждый — LaTeX)

8) "formula_build" → {{
     "parts": [
       {{ "latex": "часть формулы", "annotation": "что означает эта часть" }},
       ...
     ]
   }}

9) "example" → {{
     "problem": "Условие задачи (без LaTeX)",
     "steps": ["шаг1_latex", "шаг2_latex", ...]
   }}

10) "step_by_step" → {{
      "title": "Как решать ... (без LaTeX)",
      "steps": ["Шаг 1: текст действия", "Шаг 2: ...", ...]
    }}

11) "plot" → Один из вариантов:
    a) Квадратичная: {{ "plot_type": "quadratic", "a": число, "b": число, "c": число, "x_min": число, "x_max": число }}
    b) Линейная: {{ "plot_type": "linear", "slope": число, "intercept": число, "x_min": число, "x_max": число }}
    c) Синус: {{ "plot_type": "sine", "amplitude": число, "frequency": число, "x_min": число, "x_max": число }}
    d) Косинус: {{ "plot_type": "cosine", "amplitude": число, "frequency": число, "x_min": число, "x_max": число }}
    e) Произвольная: {{ "func_code": "lambda x: выражение", "x_min": число, "x_max": число }}
    Опционально: "integral_latex": "формула интеграла"

12) "number_line" → {{
      "x_min": число, "x_max": число,
      "points": [{{ "value": число, "label": "метка" }}, ...],
      "interval_start": число или null,
      "interval_end": число или null
    }}

13) "coordinate" → {{
      "x_range": [min, max, step],
      "y_range": [min, max, step],
      "points": [{{ "x": число, "y": число, "label": "метка" }}, ...],
      "vectors": [{{ "x1": число, "y1": число, "x2": число, "y2": число, "label": "метка" }}, ...]
    }}

14) "geometry" → {{
      "shape": "triangle" | "rectangle" | "circle",
      "title": "Описание фигуры (без LaTeX)",
      "labels": {{ "A": "метка", "B": "метка", "C": "метка", "a": "сторона a" }}
    }}
    Для rectangle: labels содержит "width", "height", "width_val", "height_val"
    Для circle: labels содержит "radius", "radius_val"

15) "fraction_visual" → {{
      "numerator": целое число,
      "denominator": целое число,
      "label": "текст (необязательно)"
    }}

16) "table" → {{
      "headers": ["Столбец1", "Столбец2", ...],
      "rows": [["значение1", "значение2"], ...],
      "highlight_row": индекс строки для подсветки (-1 = нет)
    }}

17) "comparison" → {{
      "left_title": "Заголовок слева (без LaTeX)",
      "left_content": "формула/текст LaTeX",
      "right_title": "Заголовок справа (без LaTeX)",
      "right_content": "формула/текст LaTeX",
      "left_is_correct": true/false
    }}

18) "warning" → {{
      "title": "Описание ошибки (без LaTeX)",
      "wrong_latex": "неправильная формула в LaTeX",
      "correct_latex": "правильная формула в LaTeX",
      "explanation": "почему это ошибка (без LaTeX, необязательно)"
    }}

19) "quiz" → {{
      "question": "Вопрос для ученика (без LaTeX)",
      "answer_latex": "ответ в LaTeX",
      "explanation": "пояснение к ответу (без LaTeX, необязательно)"
    }}

20) "transition" → {{ "text": "Текст перехода (без LaTeX)" }}

21) "summary" → {{
      "final_latex": "главная формула в LaTeX",
      "text": "краткий итог (без LaTeX)"
    }}

ОГРАНИЧЕНИЯ:
- Используй ТОЛЬКО шаблоны из PLAN_JSON, в том же порядке.
- Максимум 10 шагов в derivation/example.
- Максимум 160 символов в любом строковом поле.
- Никаких пустых строк.
- LaTeX БЕЗ окружающих $$ — только формульный код.
- LaTeX должен быть валидным для MathTex (Manim). Избегай \\text внутри MathTex.
- Поля помеченные "(без LaTeX)" — только русский текст, без \\frac, \\int и т.д.
- Числа для plot: маленькие целые от -10 до 10.
- Текст — простой и понятный школьнику.

ФОРМАТ ОТВЕТА:
Верни ТОЛЬКО валидный JSON (без markdown):
{{
  "scenes": [
    {{ "template": "...", "data": {{ ... }} }},
    ...
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
