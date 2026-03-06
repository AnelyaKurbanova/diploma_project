from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from typing import Any, Mapping

import aio_pika
from aio_pika import ExchangeType, Message
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequest, Conflict, NotFound
from app.data.db.session import SessionLocal
from app.modules.catalog.data.repo import CatalogRepo
from app.modules.knowledge.application.retrieval import search as knowledge_search
from app.modules.llm_usage.application.tracker import (
    extract_openai_token_usage,
    log_llm_token_usage,
)
from app.modules.lessons.data.models import LessonModel
from app.modules.problems.application.service import ProblemService
from app.modules.video_jobs.data.models import VideoJobModel
from app.settings import settings


logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    """Lazily construct a shared AsyncOpenAI client."""
    global _client
    if _client is None:
        if not settings.OPENAI_API_KEY:
            raise Conflict("OPENAI_API_KEY is not configured for video generation")
        _client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=settings.LLM_NORMALIZER_TIMEOUT_SEC * 4,
        )
    return _client


async def _publish_video_requested(job_id: uuid.UUID) -> None:
    """Publish video.requested event to RabbitMQ for the given job."""

    if not settings.RABBIT_URL:
        raise BadRequest("RABBIT_URL is not configured")

    connection = await aio_pika.connect_robust(settings.RABBIT_URL)
    try:
        channel = await connection.channel()
        exchange = await channel.declare_exchange(
            "video.events", ExchangeType.TOPIC, durable=True
        )
        payload = {"job_id": str(job_id)}
        message = Message(
            body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            content_type="application/json",
        )
        await exchange.publish(message, routing_key="video.requested")
    finally:
        await connection.close()


# ---------------------------------------------------------------------------
# Template selection constants (mirrors video_worker/app/validators.py)
# ---------------------------------------------------------------------------

_ALL_TEMPLATES = {
    "title", "hook", "goal", "recap", "definitions", "key_point",
    "derivation", "formula_build", "example", "step_by_step",
    "plot", "number_line", "coordinate", "geometry", "fraction_visual",
    "table", "comparison", "warning", "quiz", "transition", "summary",
}

_REPEATABLE_TEMPLATES = {
    "derivation", "example", "quiz", "step_by_step",
    "transition", "key_point", "warning", "recap",
}
_MAX_REPEATS = 3
_CONTENT_MAX_RETRIES = 2
_PLAN_MAX_RETRIES = 2
_LATEX_IN_PLAIN_TEXT_PATTERN = re.compile(r"\\[a-zA-Z]+\s*(\{[^}]*\})?")
_PLAIN_TEXT_FIELDS: dict[str, list[str]] = {
    "title": ["title"],
    "hook": ["text"],
    "goal": ["text"],
    "step_by_step": ["title"],
    "transition": ["text"],
    "comparison": ["left_title", "right_title"],
    "warning": ["title"],
    "quiz": ["question"],
    "key_point": ["title"],
    "example": ["problem"],
    "summary": ["text"],
}


# ---------------------------------------------------------------------------
# Validation helpers (lightweight, backend-side)
# ---------------------------------------------------------------------------

def _validate_plan_structure(data: dict[str, Any]) -> list[str]:
    """Return a list of validation error strings (empty if valid)."""
    errors: list[str] = []
    scenes = data.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        return ["Plan must contain a non-empty 'scenes' array"]
    if len(scenes) > 15:
        errors.append(f"Plan has {len(scenes)} scenes, maximum is 15")

    templates: list[str] = []
    for idx, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            errors.append(f"Scene #{idx + 1} is not an object")
            continue
        t = scene.get("template")
        if t not in _ALL_TEMPLATES:
            errors.append(f"Unknown template '{t}' at index {idx}")
        else:
            templates.append(t)

    if templates and templates[0] != "title":
        errors.append("First scene must be 'title'")
    if templates and templates[-1] != "summary":
        errors.append("Last scene must be 'summary'")

    counts: dict[str, int] = {}
    for t in templates:
        counts[t] = counts.get(t, 0) + 1
    if counts.get("title", 0) != 1:
        errors.append("Exactly one 'title' scene required")
    if counts.get("summary", 0) != 1:
        errors.append("Exactly one 'summary' scene required")
    if counts.get("plot", 0) > 1:
        errors.append("At most one 'plot' scene allowed")
    for t, c in counts.items():
        if t in ("title", "summary", "plot"):
            continue
        if t in _REPEATABLE_TEMPLATES and c > _MAX_REPEATS:
            errors.append(f"Template '{t}' used {c} times, max is {_MAX_REPEATS}")
        elif t not in _REPEATABLE_TEMPLATES and c > 1:
            errors.append(f"Template '{t}' may appear at most once, got {c}")
    return errors


def _validate_content_structure(
    data: dict[str, Any],
    plan_json: Mapping[str, Any] | None = None,
) -> list[str]:
    """Return a list of validation error strings for content JSON."""
    errors: list[str] = []
    scenes = data.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        return ["Content must contain a non-empty 'scenes' array"]

    for idx, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            errors.append(f"Scene #{idx + 1} is not an object")
            continue
        t = scene.get("template")
        if t not in _ALL_TEMPLATES:
            errors.append(f"Unknown template '{t}' at index {idx}")
        if "data" not in scene or not isinstance(scene.get("data"), dict):
            errors.append(f"Scene '{t}' at index {idx} missing 'data' object")
            continue

        data_obj = scene["data"]
        plain_fields = _PLAIN_TEXT_FIELDS.get(t, [])
        for field_name in plain_fields:
            value = data_obj.get(field_name)
            if isinstance(value, str) and _LATEX_IN_PLAIN_TEXT_PATTERN.search(value):
                errors.append(
                    f"Field '{t}.data.{field_name}' must be plain text without LaTeX commands "
                    "(e.g. \\int, \\frac). Put formulas in dedicated LaTeX fields "
                    "(value_latex, steps, final_latex)."
                )

    plan_errors = _validate_plan_structure(data)
    errors.extend(plan_errors)

    # Content must follow the generated plan 1:1 (same length and template order).
    if plan_json is not None:
        plan_scenes = plan_json.get("scenes")
        if not isinstance(plan_scenes, list):
            errors.append("Internal error: plan_json.scenes is missing or invalid")
        else:
            if len(plan_scenes) != len(scenes):
                errors.append(
                    "Content scenes length does not match plan scenes length "
                    f"({len(scenes)} vs {len(plan_scenes)})"
                )
            for idx, (plan_scene, content_scene) in enumerate(
                zip(plan_scenes, scenes, strict=False)
            ):
                plan_t = (
                    plan_scene.get("template")
                    if isinstance(plan_scene, Mapping)
                    else None
                )
                content_t = (
                    content_scene.get("template")
                    if isinstance(content_scene, Mapping)
                    else None
                )
                if plan_t != content_t:
                    errors.append(
                        f"Template mismatch at index {idx}: "
                        f"plan='{plan_t}', content='{content_t}'"
                    )
    return errors


# ---------------------------------------------------------------------------
# Step 1: Plan generation — choose the optimal template sequence
# ---------------------------------------------------------------------------

_PLAN_SYSTEM_PROMPT = (
    "Ты — опытный педагог-методист по математике и дизайнер видеоуроков.\n"
    "Ты проектируешь структуру короткого обучающего видео для школьников.\n"
    "Твоя цель — сделать урок максимально понятным даже для самых слабых учеников.\n"
    "Каждая сцена должна нести одну простую идею.\n"
    "Выбирай шаблоны ИСХОДЯ ИЗ ТЕМЫ — не используй геометрию для алгебры, "
    "графики для тем без функций, дроби для тем без дробей и т.д."
)

_PLAN_USER_TEMPLATE = """\
ТЕМА ВИДЕО: {topic_title}

REQUEST_JSON:
{request_json}

ДОСТУПНЫЙ КОНТЕКСТ ИЗ УЧЕБНИКА (краткое содержание):
{rag_summary}

Спроектируй последовательность сцен для обучающего видео.

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

ТИПЫ УРОКОВ (выбери подходящий и адаптируй под тему):

1) Введение нового понятия:
   title -> hook -> goal -> definitions -> key_point -> example -> quiz -> summary

2) Решение задач:
   title -> hook -> goal -> recap -> step_by_step -> example -> warning -> quiz -> summary

3) Вывод формулы:
   title -> goal -> definitions -> formula_build -> derivation -> example -> summary

4) Наглядная математика (геометрия, дроби, графики):
   title -> hook -> goal -> definitions -> geometry/fraction_visual/plot -> example -> summary

5) Повторение и практика:
   title -> goal -> recap -> quiz -> example -> warning -> quiz -> summary

6) Сравнение методов:
   title -> goal -> recap -> comparison -> example -> example -> summary

ПРАВИЛА:
- Первая сцена ВСЕГДА "title", последняя ВСЕГДА "summary".
- Минимум 6, максимум 15 сцен.
- "plot" — максимум 1 раз.
- "derivation", "example", "quiz", "step_by_step", "transition", "key_point", "warning", "recap" могут повторяться до 3 раз.
- Остальные шаблоны — максимум 1 раз.
- Используй "hook" чтобы заинтересовать ученика в начале.
- Используй "warning" чтобы показать типичные ошибки.
- Используй "quiz" чтобы ученик активно думал.
- Выбирай визуальные шаблоны ("plot", "number_line", "coordinate", "geometry", "fraction_visual", "table") ТОЛЬКО когда они логически соответствуют теме.
- Структура должна рассказывать связную историю: от простого к сложному.

ФОРМАТ ОТВЕТА — ТОЛЬКО валидный JSON (без markdown):
{{
  "scenes": [
    {{ "template": "title" }},
    {{ "template": "hook" }},
    ...
    {{ "template": "summary" }}
  ]
}}

ВАЖНО:
- Верни ТОЛЬКО JSON-объект.
- Не добавляй комментарии, текст до/после JSON и служебные поля.
"""


async def _generate_plan(
    *,
    client: AsyncOpenAI,
    request_json: Mapping[str, Any],
    topic_title: str,
    rag_chunks: list[str],
) -> dict[str, Any]:
    """Step 1: ask the LLM to choose the optimal scene template sequence."""

    rag_summary = "\n".join(f"- {chunk[:120]}..." for chunk in rag_chunks[:8])
    previous_errors: list[str] | None = None

    for attempt in range(_PLAN_MAX_RETRIES + 1):
        error_block = ""
        if previous_errors:
            error_block = (
                "\nОШИБКИ ПРЕДЫДУЩЕЙ ПОПЫТКИ (исправь их):\n- "
                + "\n- ".join(previous_errors)
                + "\n"
            )

        user_prompt = _PLAN_USER_TEMPLATE.format(
            topic_title=topic_title,
            request_json=json.dumps(dict(request_json), ensure_ascii=False, indent=2),
            rag_summary=rag_summary,
        ) + error_block

        request_meta = {
            "mode": request_json.get("mode"),
            "topic_title": topic_title,
            "chunks_count": len(rag_chunks),
            "step": "plan",
            "retry": bool(previous_errors),
        }

        try:
            response = await client.chat.completions.create(
                model=settings.LLM_MODEL_NAME,
                messages=[
                    {"role": "system", "content": _PLAN_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=1024,
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            await log_llm_token_usage(
                request_type="video_jobs.generate_plan",
                model_name=settings.LLM_MODEL_NAME,
                input_tokens=None, output_tokens=None, total_tokens=None,
                request_meta=request_meta,
                success=False,
                error_text=str(exc),
            )
            logger.warning("Video plan generation failed: %s", exc)
            raise Conflict(
                "Не удалось спроектировать структуру видео. Попробуйте позже."
            ) from exc

        input_tokens, output_tokens, total_tokens = extract_openai_token_usage(response)
        await log_llm_token_usage(
            request_type="video_jobs.generate_plan",
            model_name=settings.LLM_MODEL_NAME,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            request_meta=request_meta,
        )

        raw = (response.choices[0].message.content or "").strip()
        if not raw:
            errors = ["Модель вернула пустой план видео"]
        else:
            try:
                data = json.loads(raw)
                errors = _validate_plan_structure(data)
                if not errors:
                    return data
            except Exception as exc:
                logger.warning("Failed to parse plan JSON: %s; snippet=%r", exc, raw[:2000])
                errors = ["Не удалось разобрать JSON плана"]

        logger.warning(
            "Plan validation failed (attempt %d/%d): %s",
            attempt + 1,
            _PLAN_MAX_RETRIES + 1,
            "; ".join(errors),
        )
        if attempt < _PLAN_MAX_RETRIES:
            previous_errors = errors
            continue
        raise Conflict(
            f"Не удалось сгенерировать валидный план видео после "
            f"{_PLAN_MAX_RETRIES + 1} попыток: {'; '.join(errors)}"
        )

    raise Conflict("Не удалось сгенерировать план видео")


# ---------------------------------------------------------------------------
# Step 2: Content generation — fill in data for each scene
# ---------------------------------------------------------------------------

_CONTENT_SYSTEM_PROMPT = (
    "Ты — опытный учитель математики и эксперт по LaTeX.\n"
    "Ты создаёшь контент для обучающего видео, заполняя данные для каждой сцены.\n"
    "Твоя целевая аудитория — школьники 10-16 лет, включая самых слабых учеников.\n"
    "ПЕДАГОГИЧЕСКИЕ ПРИНЦИПЫ:\n"
    "- Объясняй как 12-летнему ребёнку.\n"
    "- Используй простые бытовые аналогии.\n"
    "- Разбивай сложные идеи на крошечные шаги.\n"
    "- Каждая формула должна быть объяснена словами.\n"
    "- Выделяй ОДИН самый важный вывод.\n"
    "- Все текстовые поля — на русском языке.\n"
    "- LaTeX пиши без окружающих $$ — только формульный код.\n"
    "- Используй ТОЛЬКО информацию из переданного контекста учебника. "
    "Не придумывай новых фактов или формул."
)

_CONTENT_USER_TEMPLATE = """\
ТЕМА ВИДЕО: {topic_title}

REQUEST_JSON:
{request_json}

ПЛАН СЦЕН:
{plan_json}

КОНТЕКСТ УЧЕБНИКА (ИСПОЛЬЗУЙ ТОЛЬКО ЕГО):
{context}
{error_block}
Заполни данные для каждой сцены из ПЛАНА.

СХЕМЫ ДАННЫХ ДЛЯ КАЖДОГО ШАБЛОНА:

1) "title" -> {{ "title": "Название темы (без LaTeX, русский текст)" }}

2) "hook" -> {{ "text": "Интересный вопрос или факт (без LaTeX)" }}

3) "goal" -> {{ "text": "Что ученик узнает (без LaTeX)" }}

4) "recap" -> {{ "items": ["Факт 1", "Факт 2", ...] }}
   (список предпосылок, 2-5 пунктов)

5) "definitions" -> {{
     "items": [
       {{ "label": "Название термина", "value_latex": "формула в LaTeX" }},
       ...
     ]
   }}

6) "key_point" -> {{
     "title": "Название правила (без LaTeX)",
     "formula_latex": "главная формула в LaTeX",
     "explanation": "пояснение простыми словами (без LaTeX, необязательно)"
   }}

7) "derivation" -> {{ "steps": ["шаг1_latex", "шаг2_latex", ...] }}
   (максимум 10 шагов, каждый — LaTeX)

8) "formula_build" -> {{
     "parts": [
       {{ "latex": "часть формулы", "annotation": "что означает эта часть" }},
       ...
     ]
   }}

9) "example" -> {{
     "problem": "Условие задачи (без LaTeX)",
     "steps": ["шаг1_latex", "шаг2_latex", ...]
   }}

10) "step_by_step" -> {{
      "title": "Как решать ... (без LaTeX)",
      "steps": ["Шаг 1: текст действия", "Шаг 2: ...", ...]
    }}

11) "plot" -> Один из вариантов:
    a) Квадратичная: {{ "plot_type": "quadratic", "a": число, "b": число, "c": число, "x_min": число, "x_max": число }}
    b) Линейная: {{ "plot_type": "linear", "slope": число, "intercept": число, "x_min": число, "x_max": число }}
    c) Синус: {{ "plot_type": "sine", "amplitude": число, "frequency": число, "x_min": число, "x_max": число }}
    d) Косинус: {{ "plot_type": "cosine", "amplitude": число, "frequency": число, "x_min": число, "x_max": число }}
    e) Произвольная: {{ "func_code": "lambda x: выражение", "x_min": число, "x_max": число }}
    Опционально: "integral_latex": "формула интеграла"

12) "number_line" -> {{
      "x_min": число, "x_max": число,
      "points": [{{ "value": число, "label": "метка" }}, ...],
      "interval_start": число или null,
      "interval_end": число или null
    }}

13) "coordinate" -> {{
      "x_range": [min, max, step],
      "y_range": [min, max, step],
      "points": [{{ "x": число, "y": число, "label": "метка" }}, ...],
      "vectors": [{{ "x1": число, "y1": число, "x2": число, "y2": число, "label": "метка" }}, ...]
    }}

14) "geometry" -> {{
      "shape": "triangle" | "rectangle" | "circle",
      "title": "Описание фигуры (без LaTeX)",
      "labels": {{ "A": "метка", "B": "метка", "C": "метка", "a": "сторона a" }}
    }}
    Для rectangle: labels содержит "width", "height", "width_val", "height_val"
    Для circle: labels содержит "radius", "radius_val"

15) "fraction_visual" -> {{
      "numerator": целое число,
      "denominator": целое число,
      "label": "текст (необязательно)"
    }}

16) "table" -> {{
      "headers": ["Столбец1", "Столбец2", ...],
      "rows": [["значение1", "значение2"], ...],
      "highlight_row": индекс строки для подсветки (-1 = нет)
    }}

17) "comparison" -> {{
      "left_title": "Заголовок слева (без LaTeX)",
      "left_content": "формула/текст LaTeX",
      "right_title": "Заголовок справа (без LaTeX)",
      "right_content": "формула/текст LaTeX",
      "left_is_correct": true/false
    }}

18) "warning" -> {{
      "title": "Описание ошибки (без LaTeX)",
      "wrong_latex": "неправильная формула в LaTeX",
      "correct_latex": "правильная формула в LaTeX",
      "explanation": "почему это ошибка (без LaTeX, необязательно)"
    }}

19) "quiz" -> {{
      "question": "Вопрос для ученика (без LaTeX)",
      "answer_latex": "ответ в LaTeX",
      "explanation": "пояснение к ответу (без LaTeX, необязательно)"
    }}

20) "transition" -> {{ "text": "Текст перехода (без LaTeX)" }}

21) "summary" -> {{
      "final_latex": "главная формула в LaTeX",
      "text": "краткий итог (без LaTeX)"
    }}

ОГРАНИЧЕНИЯ:
- Используй ТОЛЬКО шаблоны из ПЛАНА, в том же порядке.
- Максимум 10 шагов в derivation/example.
- Максимум 160 символов в любом строковом поле.
- Никаких пустых строк.
- LaTeX БЕЗ окружающих $$ — только формульный код.
- LaTeX должен быть валидным для MathTex (Manim). Избегай \\text внутри MathTex.
- Поля помеченные "(без LaTeX)" — только русский текст, без \\frac, \\int и т.д.
- В "quiz.question" ЗАПРЕЩЕНЫ LaTeX-команды и формулы: это только обычный русский текст-вопрос.
- Числа для plot: маленькие целые от -10 до 10.
- Текст — простой и понятный школьнику.

ФОРМАТ ОТВЕТА — ТОЛЬКО валидный JSON (без markdown):
{{
  "scenes": [
    {{ "template": "...", "data": {{ ... }} }},
    ...
  ]
}}"""


async def _generate_content_from_plan(
    *,
    client: AsyncOpenAI,
    request_json: Mapping[str, Any],
    plan_json: dict[str, Any],
    topic_title: str,
    rag_chunks: list[str],
    previous_errors: list[str] | None = None,
) -> dict[str, Any]:
    """Step 2: fill in scene data for every template in the plan using RAG context."""

    context = "\n\n---\n\n".join(rag_chunks)

    error_block = ""
    if previous_errors:
        error_block = (
            "\nОШИБКИ ПРЕДЫДУЩЕЙ ПОПЫТКИ (исправь их):\n- "
            + "\n- ".join(previous_errors)
            + "\n"
        )

    plan_templates = [
        scene.get("template")
        for scene in plan_json.get("scenes", [])
        if isinstance(scene, Mapping)
    ]
    plan_sequence = "\n".join(
        f"{idx + 1}) {template}" for idx, template in enumerate(plan_templates)
    )

    user_prompt = _CONTENT_USER_TEMPLATE.format(
        topic_title=topic_title,
        request_json=json.dumps(dict(request_json), ensure_ascii=False, indent=2),
        plan_json=json.dumps(plan_json, ensure_ascii=False, indent=2),
        context=context,
        error_block=error_block,
    ) + (
        "\n\nСТРОГОЕ ТРЕБОВАНИЕ:\n"
        f"- Верни РОВНО {len(plan_templates)} сцен.\n"
        "- Не добавляй и не удаляй сцены.\n"
        "- Сохрани ТОЧНЫЙ порядок шаблонов из плана.\n"
        "- Если не хватает данных, заполни кратко, но не меняй структуру.\n"
        "Последовательность шаблонов по индексам:\n"
        f"{plan_sequence}\n"
    )

    request_meta = {
        "mode": request_json.get("mode"),
        "topic_title": topic_title,
        "chunks_count": len(rag_chunks),
        "step": "content",
        "retry": bool(previous_errors),
    }

    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL_NAME,
            messages=[
                {"role": "system", "content": _CONTENT_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=8192,
            response_format={"type": "json_object"},
        )
    except Exception as exc:
        await log_llm_token_usage(
            request_type="video_jobs.generate_content",
            model_name=settings.LLM_MODEL_NAME,
            input_tokens=None, output_tokens=None, total_tokens=None,
            request_meta=request_meta,
            success=False,
            error_text=str(exc),
        )
        logger.warning("Video content generation failed: %s", exc)
        raise Conflict(
            "Не удалось сгенерировать контент видео. Попробуйте позже."
        ) from exc

    input_tokens, output_tokens, total_tokens = extract_openai_token_usage(response)
    await log_llm_token_usage(
        request_type="video_jobs.generate_content",
        model_name=settings.LLM_MODEL_NAME,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        request_meta=request_meta,
    )

    raw = (response.choices[0].message.content or "").strip()
    if not raw:
        raise Conflict("Модель вернула пустой контент видео")

    try:
        data = json.loads(raw)
    except Exception as exc:
        logger.warning(
            "Failed to parse content JSON: %s; snippet=%r", exc, raw[:2000]
        )
        raise Conflict("Не удалось разобрать контент видео.") from exc

    return data


# ---------------------------------------------------------------------------
# Orchestrator: 2-step generation (plan -> content) with retry
# ---------------------------------------------------------------------------

async def _generate_video_content_json(
    *,
    request_json: Mapping[str, Any],
    topic_title: str,
    rag_chunks: list[str],
) -> dict[str, Any]:
    """Generate full video content JSON using a 2-step LLM approach.

    Step 1 -- Plan: LLM selects the optimal template sequence for the topic.
    Step 2 -- Content: LLM fills in data for each scene using RAG context.
    """

    client = _get_client()

    topic_title = (topic_title or "").strip()
    if not topic_title or not rag_chunks:
        raise Conflict("Недостаточно учебных материалов для генерации видео")

    # --- Step 1: generate plan (template sequence) ---
    plan_json = await _generate_plan(
        client=client,
        request_json=request_json,
        topic_title=topic_title,
        rag_chunks=rag_chunks,
    )
    logger.info(
        "Plan generated: %d scenes — %s",
        len(plan_json.get("scenes", [])),
        [s.get("template") for s in plan_json.get("scenes", [])],
    )

    # --- Step 2: generate content with retry on validation errors ---
    previous_errors: list[str] | None = None
    for attempt in range(_CONTENT_MAX_RETRIES + 1):
        content_json = await _generate_content_from_plan(
            client=client,
            request_json=request_json,
            plan_json=plan_json,
            topic_title=topic_title,
            rag_chunks=rag_chunks,
            previous_errors=previous_errors,
        )

        errors = _validate_content_structure(content_json, plan_json=plan_json)
        if not errors:
            return content_json

        logger.warning(
            "Content validation failed (attempt %d/%d): %s",
            attempt + 1,
            _CONTENT_MAX_RETRIES + 1,
            "; ".join(errors),
        )
        if attempt < _CONTENT_MAX_RETRIES:
            previous_errors = errors
        else:
            raise Conflict(
                f"Не удалось сгенерировать валидный контент видео после "
                f"{_CONTENT_MAX_RETRIES + 1} попыток: {'; '.join(errors)}"
            )

    raise Conflict("Не удалось сгенерировать контент видео")


class VideoJobService:
    """Service for creating RAG-based video jobs (problems and topics)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.problem_service = ProblemService(session)
        self.catalog_repo = CatalogRepo(session)

    async def _build_problem_request_payload(
        self,
        problem_id: uuid.UUID,
    ) -> tuple[dict[str, Any], str, list[str]]:
        problem = await self.problem_service.get(problem_id)

        subject_row = await self.catalog_repo.get_subject(problem.subject_id)
        topic_title = None
        if problem.topic_id:
            try:
                topic_row = await self.catalog_repo.get_topic(problem.topic_id)
                if topic_row.subject_id != subject_row.id:
                    raise Conflict("Тема задачи не относится к её предмету")
                topic_title = topic_row.title_ru
            except NotFound:
                topic_title = None

        query_title = topic_title or problem.title

        chunks = await knowledge_search(
            self.session,
            query_title,
            subject_code=subject_row.code,
            k=24,
        )
        if not chunks:
            raise NotFound(
                "Нет учебных материалов по предмету. "
                "Сначала загрузите docx через /knowledge/ingest."
            )

        request_json: dict[str, Any] = {
            "mode": "problem",
            "problem_id": str(problem.id),
            "subject_id": str(problem.subject_id),
            "topic_id": str(problem.topic_id) if problem.topic_id else None,
            "difficulty": getattr(problem.difficulty, "value", str(problem.difficulty)),
            "title": problem.title,
            "statement": problem.statement,
            "topic_title": topic_title,
            "subject_code": subject_row.code,
        }
        return request_json, query_title, [c.content for c in chunks]

    async def _build_topic_request_payload(
        self,
        topic_id: uuid.UUID,
        lesson_id: uuid.UUID | None = None,
    ) -> tuple[dict[str, Any], str, list[str]]:
        topic = await self.catalog_repo.get_topic(topic_id)
        subject = await self.catalog_repo.get_subject(topic.subject_id)

        lesson_title: str | None = None
        query_title = topic.title_ru
        if lesson_id is not None:
            lesson = await self.session.get(LessonModel, lesson_id)
            if lesson is None:
                raise NotFound("Урок не найден")
            if lesson.topic_id != topic_id:
                raise Conflict("Урок не относится к выбранной теме")
            lesson_title = lesson.title
            query_title = lesson_title

        chunks = await knowledge_search(
            self.session,
            query_title,
            subject_code=subject.code,
            k=24,
        )
        if not chunks:
            raise NotFound(
                "Нет учебных материалов по предмету. "
                "Сначала загрузите docx через /knowledge/ingest."
            )

        request_json: dict[str, Any] = {
            "mode": "topic",
            "topic_id": str(topic.id),
            "lesson_id": str(lesson_id) if lesson_id else None,
            "lesson_title": lesson_title,
            "subject_id": str(subject.id),
            "topic_title": topic.title_ru,
            "subject_code": subject.code,
            "grade_level": topic.grade_level,
        }
        return request_json, query_title, [c.content for c in chunks]

    @staticmethod
    async def _mark_job_failed(job_id: uuid.UUID, error_text: str) -> None:
        async with SessionLocal() as session:
            job = await session.get(VideoJobModel, job_id)
            if job is None:
                return
            job.status = "failed"
            job.error_text = error_text
            await session.commit()

    @staticmethod
    async def _run_problem_job_background(job_id: uuid.UUID, problem_id: uuid.UUID) -> None:
        try:
            async with SessionLocal() as session:
                svc = VideoJobService(session)
                request_json, query_title, rag_chunks = await svc._build_problem_request_payload(problem_id)
                content_json = await _generate_video_content_json(
                    request_json=request_json,
                    topic_title=query_title,
                    rag_chunks=rag_chunks,
                )

                job = await session.get(VideoJobModel, job_id)
                if job is None:
                    return
                job.request_json = request_json
                job.plan_json = content_json
                job.status = "queued"
                job.error_text = None
                await session.commit()

            await _publish_video_requested(job_id)
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "Background planning failed for problem video job",
                extra={"job_id": str(job_id), "problem_id": str(problem_id)},
            )
            await VideoJobService._mark_job_failed(job_id, str(exc))

    @staticmethod
    async def _run_topic_job_background(
        job_id: uuid.UUID,
        topic_id: uuid.UUID,
        lesson_id: uuid.UUID | None = None,
    ) -> None:
        try:
            async with SessionLocal() as session:
                svc = VideoJobService(session)
                request_json, query_title, rag_chunks = await svc._build_topic_request_payload(
                    topic_id,
                    lesson_id=lesson_id,
                )
                content_json = await _generate_video_content_json(
                    request_json=request_json,
                    topic_title=query_title,
                    rag_chunks=rag_chunks,
                )

                job = await session.get(VideoJobModel, job_id)
                if job is None:
                    return
                job.request_json = request_json
                job.plan_json = content_json
                job.status = "queued"
                job.error_text = None
                await session.commit()

            await _publish_video_requested(job_id)
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "Background planning failed for topic video job",
                extra={
                    "job_id": str(job_id),
                    "topic_id": str(topic_id),
                    "lesson_id": str(lesson_id) if lesson_id else None,
                },
            )
            await VideoJobService._mark_job_failed(job_id, str(exc))

    async def create_problem_video_job(self, problem_id: uuid.UUID) -> VideoJobModel:
        """Create a video job and prepare content asynchronously."""

        job = VideoJobModel(
            status="planning",
            request_json={
                "mode": "problem",
                "problem_id": str(problem_id),
            },
            plan_json=None,
            result_json=None,
            error_text=None,
        )
        self.session.add(job)
        await self.session.commit()

        asyncio.create_task(
            self._run_problem_job_background(
                job_id=job.id,
                problem_id=problem_id,
            )
        )
        return job

    async def create_topic_video_job(
        self,
        topic_id: uuid.UUID,
        lesson_id: uuid.UUID | None = None,
    ) -> VideoJobModel:
        """Create a video job and prepare content asynchronously."""

        job = VideoJobModel(
            status="planning",
            request_json={
                "mode": "topic",
                "topic_id": str(topic_id),
                "lesson_id": str(lesson_id) if lesson_id else None,
            },
            plan_json=None,
            result_json=None,
            error_text=None,
        )
        self.session.add(job)
        await self.session.commit()

        asyncio.create_task(
            self._run_topic_job_background(
                job_id=job.id,
                topic_id=topic_id,
                lesson_id=lesson_id,
            )
        )
        return job
