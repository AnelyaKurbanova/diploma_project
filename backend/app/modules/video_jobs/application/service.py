from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Mapping

import aio_pika
from aio_pika import ExchangeType, Message
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequest, Conflict, NotFound
from app.modules.catalog.data.repo import CatalogRepo
from app.modules.knowledge.application.retrieval import search as knowledge_search
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


async def _generate_video_content_json(
    *,
    request_json: Mapping[str, Any],
    topic_title: str,
    rag_chunks: list[str],
) -> dict[str, Any]:
    """Generate full video content JSON (scenes) from RAG context using LLM.

    The returned object is expected to conform to video_worker CONTENT_SCHEMA:
      {
        "scenes": [
          { "template": "...", "data": { ... } },
          ...
        ]
      }
    """

    client = _get_client()

    topic_title = (topic_title or "").strip()
    if not topic_title or not rag_chunks:
        raise Conflict("Недостаточно учебных материалов для генерации видео")

    system_prompt = (
        "Ты — опытный преподаватель математики и автор коротких объясняющих видео.\n"
        "Твоя задача — по готовым фрагментам учебника (RAG-контекст) составить СЦЕНАРИЙ "
        "одноминутного видео на русском языке.\n"
        "Видео следует строгой структуре (порядок сцен менять нельзя):\n"
        "1) title — HOOK: цепляющий заголовок, только обычный русский текст, без формул и LaTeX.\n"
        "2) goal — PROBLEM: формулировка задачи/цели, только обычный русский текст, без LaTeX.\n"
        "3) definitions — INTUITION: 2–3 интуитивных пункта; формулы только в поле value_latex (LaTeX без $ и $$).\n"
        "4) derivation — DERIVATION: пошаговый вывод основной формулы (4–6 шагов в LaTeX в массиве steps).\n"
        "5) plot — VISUALIZATION: график функции, задаётся кодом функции (func_code), границами и формулой интеграла.\n"
        "6) derivation (второй раз) — EXAMPLE: решение одного конкретного числового примера (4–6 шагов), подставь числа, покажи итоговый ответ.\n"
        "7) summary — SUMMARY: итоговая формула в final_latex и короткое резюме в text (только русский текст, без LaTeX в text).\n\n"
        "Очень важно:\n"
        "- Используй ТОЛЬКО информацию из переданного контекста. Не придумывай новых фактов или формул.\n"
        "- Поля title (заголовок), goal.text и summary.text — ТОЛЬКО обычный русский текст, без команд LaTeX (\\int, \\frac, \\sum и т.п.). Формулы — только в value_latex, steps и final_latex.\n"
        "- title, goal.text и summary.text — не более двух коротких предложений.\n"
        "- В definitions делай не более трёх пунктов.\n"
        "- В массивах steps используй 4–6 шагов; каждый следующий шаг — это предыдущая формула с одним-двумя изменениями, без пояснительного текста внутри формулы.\n"
        "- Текст короткий, разговорный, понятный школьнику. Не добавляй мета-комментарии вроде «в этом видео мы рассмотрели...» в Summary.\n"
    )

    context = "\n\n---\n\n".join(rag_chunks)

    # Объясняем модели, как сопоставить логические блоки с техническими шаблонами video_worker.
    user_prompt = f"""
ТЕМА ВИДЕО: {topic_title}

REQUEST_JSON (метаданные запроса):
{json.dumps(dict(request_json), ensure_ascii=False, indent=2)}

КОНТЕКСТ УЧЕБНИКА (ИСПОЛЬЗУЙ ТОЛЬКО ЕГО):
{context}

Нужно выдать ЧИСТЫЙ JSON-объект со сценами для видео. Порядок сцен СТРОГО такой (ровно 7 сцен):

{{
  "scenes": [
    {{
      "template": "title",
      "data": {{
        "title": "Короткий цепляющий заголовок только русским текстом, без формул"
      }}
    }},
    {{
      "template": "goal",
      "data": {{
        "text": "Формулировка задачи только русским текстом, без LaTeX"
      }}
    }},
    {{
      "template": "definitions",
      "data": {{
        "items": [
          {{
            "label": "Интуиция 1",
            "value_latex": "Формула или короткая запись в LaTeX (без $ и $$)"
          }}
        ]
      }}
    }},
    {{
      "template": "derivation",
      "data": {{
        "steps": [
          "Первый шаг вывода в LaTeX",
          "Второй шаг",
          "..."
        ]
      }}
    }},
    {{
      "template": "plot",
      "data": {{
        "func_code": "lambda x: 0.5 * x**2 - 2",
        "x_min": -5,
        "x_max": 5,
        "a": -1,
        "b": 2,
        "integral_latex": "\\\\int_{-1}^2 \\left(0.5 x^2 - 2\\right)\\\\,dx"
      }}
    }},
    {{
      "template": "derivation",
      "data": {{
        "steps": [
          "Числовой пример: подставь конкретные числа, покажи шаги и ответ в LaTeX",
          "Например: 2+2=4, следующий шаг...",
          "Итоговый ответ"
        ]
      }}
    }},
    {{
      "template": "summary",
      "data": {{
        "final_latex": "Итоговая формула в LaTeX",
        "text": "Короткое резюме 1–2 фразы только русским текстом, без LaTeX"
      }}
    }}
  ]
}}

Правила:
- Ровно 7 сцен в указанном порядке. Два блока derivation: первый — вывод формулы, второй — решение числового примера с подставленными числами и чётким ответом.
- В каждом объекте сцены поля "template" и "data". Во всех строках максимум ~160 символов, без пустых строк.
- title.data.title, goal.data.text, summary.data.text — только обычный русский текст, без команд LaTeX (\\int, \\frac и т.д.). Формулы только в value_latex, steps, final_latex.
- plot: обязательно поля "func_code", "x_min", "x_max". func_code — строка с Python-выражением функции одной переменной x, например "lambda x: x**2" или "lambda x: math.sin(x)". Можно использовать math (sin, cos, sqrt и т.д.). Без импортов и побочных эффектов. График должен иллюстрировать тему.
- Дополнительно для plot можно передать a и b — границы интегрирования (числа внутри [x_min, x_max]) и integral_latex — запись интеграла в LaTeX (например, "\\\\int_0^2 x\\\\,dx"), чтобы связать закрашенную площадь с формулой.
- Число шагов в каждом steps не больше 6.

Вывод:
- Верни ТОЛЬКО один валидный JSON в UTF-8, без комментариев и текста вокруг.
""".strip()

    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=4096,
            response_format={"type": "json_object"},
        )
    except Exception as exc:  # pragma: no cover - защитный код
        logger.warning("Video script generation failed: %s", exc)
        raise Conflict("Не удалось сгенерировать сценарий видео. Попробуйте позже.") from exc

    content = response.choices[0].message.content or ""
    raw = content.strip()
    if not raw:
        raise Conflict("Модель вернула пустой сценарий видео")

    try:
        data = json.loads(raw)
    except Exception as exc:  # pragma: no cover - защитный код
        logger.warning("Failed to parse JSON for video script: %s; snippet=%r", exc, raw[:2000])
        raise Conflict("Не удалось разобрать сценарий видео. Попробуйте ещё раз.") from exc

    # Минимальная структурная проверка: scenes – непустой массив, шаблоны из allowlist.
    scenes = data.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        raise Conflict("Сценарий видео не содержит сцен")

    allowed_templates = {"title", "goal", "definitions", "derivation", "plot", "summary"}
    plot_count = 0
    for idx, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            raise Conflict(f"Сцена #{idx + 1} имеет неверный формат")
        template = scene.get("template")
        if template not in allowed_templates:
            raise Conflict(f"Недопустимый шаблон сцены '{template}'")
        if "data" not in scene or not isinstance(scene["data"], dict):
            raise Conflict(f"Сцена '{template}' должна содержать объект data")
        if template == "plot":
            plot_count += 1
    if plot_count > 1:
        raise Conflict("Сценарий может содержать не более одной сцены 'plot'")

    return data


class VideoJobService:
    """Service for creating RAG-based video jobs (problems and topics)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.problem_service = ProblemService(session)
        self.catalog_repo = CatalogRepo(session)

    async def create_problem_video_job(self, problem_id: uuid.UUID) -> VideoJobModel:
        """Create a video job for a specific problem (mode='problem')."""

        problem = await self.problem_service.get(problem_id)

        # Получаем предмет и (опционально) тему для RAG-поиска.
        subject_row = await self.catalog_repo.get_subject(problem.subject_id)
        topic_title = None
        if problem.topic_id:
            try:
                topic_row = await self.catalog_repo.get_topic(problem.topic_id)
                if topic_row.subject_id != subject_row.id:
                    raise Conflict("Тема задачи не относится к её предмету")
                topic_title = topic_row.title_ru
            except NotFound:
                # Если темы нет, падаем обратно к названию задачи.
                topic_title = None

        # Запрос для RAG: по возможности используем заголовок темы, иначе заголовок задачи.
        query_title = topic_title or problem.title

        # Ищем релевантные фрагменты в базе знаний.
        chunks = await knowledge_search(
            self.session,
            query_title,
            subject_code=subject_row.code,
            k=24,
        )
        if not chunks:
            raise NotFound(
                "Нет учебных материалов по предмету. Сначала загрузите docx через /knowledge/ingest."
            )

        rag_texts = [c.content for c in chunks]

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

        content_json = await _generate_video_content_json(
            request_json=request_json,
            topic_title=query_title,
            rag_chunks=rag_texts,
        )

        job = VideoJobModel(
            status="queued",
            request_json=request_json,
            plan_json=content_json,
            result_json=None,
            error_text=None,
        )
        self.session.add(job)
        await self.session.commit()

        await _publish_video_requested(job.id)
        return job

    async def create_topic_video_job(self, topic_id: uuid.UUID) -> VideoJobModel:
        """Create a video job for an entire topic (mode='topic')."""

        topic = await self.catalog_repo.get_topic(topic_id)
        subject = await self.catalog_repo.get_subject(topic.subject_id)

        query_title = topic.title_ru

        chunks = await knowledge_search(
            self.session,
            query_title,
            subject_code=subject.code,
            k=24,
        )
        if not chunks:
            raise NotFound(
                "Нет учебных материалов по предмету. Сначала загрузите docx через /knowledge/ingest."
            )

        rag_texts = [c.content for c in chunks]

        request_json: dict[str, Any] = {
            "mode": "topic",
            "topic_id": str(topic.id),
            "subject_id": str(subject.id),
            "topic_title": topic.title_ru,
            "subject_code": subject.code,
            "grade_level": topic.grade_level,
        }

        content_json = await _generate_video_content_json(
            request_json=request_json,
            topic_title=query_title,
            rag_chunks=rag_texts,
        )

        job = VideoJobModel(
            status="queued",
            request_json=request_json,
            plan_json=content_json,
            result_json=None,
            error_text=None,
        )
        self.session.add(job)
        await self.session.commit()

        await _publish_video_requested(job.id)
        return job

