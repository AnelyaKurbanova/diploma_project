from __future__ import annotations

import logging
from typing import Sequence
import re

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


async def generate_distractors(
    *,
    question: str,
    correct_answer: str,
    count: int = 3,
) -> list[str]:
    if not settings.OPENAI_API_KEY:
        logger.debug("OPENAI_API_KEY not configured – skipping distractor generation")
        return []

    question = question.strip()
    correct_answer = correct_answer.strip()
    if not question or not correct_answer:
        return []

    if count < 1:
        count = 1
    if count > 6:
        count = 6

    client = _get_client()

    system_prompt = (
        "Ты помощник-генератор неправильных вариантов ответов для школьных задач. "
        "Говори ТОЛЬКО по-русски.\n\n"
        "Твоя задача — придумать несколько ПРАВДОПОДОБНЫХ, но НЕПРАВИЛЬНЫХ вариантов. "
        "Не повторяй правильный ответ, не добавляй комментариев.\n\n"
        "Формат ответа: каждый вариант на отдельной строке, без нумерации и без пояснений."
    )

    user_prompt = (
        f"Вопрос: {question}\n"
        f"Правильный ответ: {correct_answer}\n"
        f"Сгенерируй {count} разных неправильных вариантов ответа."
    )

    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=96,
            temperature=0.7,
        )
        content = response.choices[0].message.content or ""
        lines: Sequence[str] = [line.strip() for line in content.splitlines()]
        options: list[str] = []
        seen: set[str] = set()
        for line in lines:
            if not line:
                continue
            # убираем возможную нумерацию вида "1) ..." или "- ..."
            cleaned = line.lstrip("-•0123456789.) ").strip()
            if not cleaned:
                continue
            # Если модель вернула несколько чисел в одной строке (например "16 24 64"
            # или "16, 24, 64."), аккуратно разбиваем их на отдельные варианты.
            candidates: list[str]
            has_letters = re.search(r"[A-Za-zА-Яа-я]", cleaned) is not None
            numbers = re.findall(r"\d+", cleaned)
            if not has_letters and len(numbers) >= 2:
                candidates = numbers
            else:
                candidates = [cleaned]

            for cand in candidates:
                if cand.lower() == correct_answer.lower():
                    continue
                if cand in seen:
                    continue
                seen.add(cand)
                options.append(cand)
                if len(options) >= count:
                    break

            if len(options) >= count:
                break
        if options:
            return options

        # Если по строчкам ничего не распарсилось, но модель вернула текст —
        # вернём этот текст одной строкой, чтобы автор видел результат.
        cleaned_all = content.strip()
        if cleaned_all:
            return [cleaned_all]

        return []
    except Exception as exc:  # pragma: no cover - защитный код
        logger.warning("LLM distractor generation failed: %s", exc)
        return []

