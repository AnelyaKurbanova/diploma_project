from __future__ import annotations

import logging

from openai import AsyncOpenAI

from app.modules.llm_usage.application.tracker import (
    extract_openai_token_usage,
    log_llm_token_usage,
)
from app.settings import settings
from app.modules.problems.application.canonicalize import normalize_for_storage

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
        input_tokens, output_tokens, total_tokens = extract_openai_token_usage(response)
        await log_llm_token_usage(
            request_type="problems.generate_explanation",
            model_name=settings.LLM_MODEL_NAME,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            request_meta={
                "question_len": len(question),
                "correct_answer_len": len(correct_answer),
                "choices_count": len(choices or []),
            },
        )

        content = response.choices[0].message.content or ""
        explanation = content.strip()
        if not explanation:
            return None

        # Добавляем в конец объяснения явный текстовый ответ без форматирования LaTeX,
        # чтобы автор и ученик ясно видели, какое значение ожидает система.
        canonical_answer = normalize_for_storage(correct_answer) or correct_answer.strip()
        if canonical_answer:
            suffix = f" (Ожидаемый ответ от ученика: {canonical_answer})"
            if suffix not in explanation:
                explanation = f"{explanation.rstrip()}{suffix}"

        return explanation
    except Exception as exc:  # pragma: no cover - защитный код
        await log_llm_token_usage(
            request_type="problems.generate_explanation",
            model_name=settings.LLM_MODEL_NAME,
            input_tokens=None,
            output_tokens=None,
            total_tokens=None,
            request_meta={
                "question_len": len(question),
                "correct_answer_len": len(correct_answer),
                "choices_count": len(choices or []),
            },
            success=False,
            error_text=str(exc),
        )
        logger.warning("LLM explanation generation failed: %s", exc)
        return None

