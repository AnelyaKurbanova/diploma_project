from __future__ import annotations

import logging

from openai import AsyncOpenAI

from app.settings import settings

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=settings.LLM_NORMALIZER_TIMEOUT_SEC,
        )
    return _client


async def generate_explanation(
    *,
    question: str,
    correct_answer: str,
    choices: list[str] | None = None,
) -> str | None:
    """Generate a short explanation for a problem.

    Форматируем промпт так, чтобы ответ был коротким, на русском и
    без лишнего текста вокруг.
    """
    if not settings.OPENAI_API_KEY:
        logger.debug("OPENAI_API_KEY not configured – skipping explanation generation")
        return None

    question = question.strip()
    correct_answer = correct_answer.strip()
    if not question or not correct_answer:
        return None

    client = _get_client()

    system_prompt = (
        "Ты объясняешь решения школьных задач простым языком на русском.\n"
        "Дай короткое, понятное объяснение правильного ответа, 2–4 предложения.\n"
        "Не повторяй дословно условие, не давай лишний текст до или после объяснения."
    )

    parts: list[str] = [f"Условие: {question}", f"Правильный ответ: {correct_answer}"]
    if choices:
        joined = "; ".join(choices)
        parts.append(f"Варианты ответов: {joined}")

    user_prompt = "\n".join(parts)

    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=192,
        )
        content = response.choices[0].message.content or ""
        explanation = content.strip()
        # обрезаем возможные лишние переводы строк в конце
        return explanation or None
    except Exception as exc:  # pragma: no cover - защитный код
        logger.warning("LLM explanation generation failed: %s", exc)
        return None

