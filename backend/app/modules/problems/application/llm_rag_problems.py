from __future__ import annotations

import json
import logging
from typing import List

from openai import AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError

from app.modules.llm_usage.application.tracker import (
    extract_openai_token_usage,
    log_llm_token_usage,
)
from app.settings import settings


logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=settings.LLM_NORMALIZER_TIMEOUT_SEC * 4,
        )
    return _client


class GeneratedChoice(BaseModel):
    text: str = Field(min_length=1)
    is_correct: bool = False


class GeneratedProblem(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    statement: str = Field(min_length=1)
    type: str = Field(pattern="^(single_choice|multiple_choice|short_text)$")
    difficulty: str = Field(pattern="^(easy|medium|hard)$")

    choices: List[GeneratedChoice] | None = None
    text_answer: str | None = None
    explanation: str | None = None


class GeneratedProblemsEnvelope(BaseModel):
    problems: List[GeneratedProblem]


def _extract_json_block(text: str) -> str | None:
    """Best-effort extraction of the first JSON object from LLM output."""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    return text[start : end + 1]


async def generate_problems_from_context(
    topic_title: str,
    chunks: list[str],
    count: int = 10,
    difficulty_quota: dict[str, int] | None = None,
) -> list[GeneratedProblem]:
    """Generate structured problems using only provided RAG chunks."""

    if not settings.OPENAI_API_KEY:
        logger.debug("OPENAI_API_KEY not configured – skipping RAG problem generation")
        return []

    topic_title = (topic_title or "").strip()
    if not topic_title or not chunks:
        return []

    if count < 1:
        count = 1
    if count > 30:
        count = 30

    client = _get_client()

    system_prompt = (
        "Ты составляешь школьные задачи по математике (или другому школьному предмету) "
        "на русском языке на основе фрагментов учебника.\n"
        "Используй ТОЛЬКО информацию из контекста. Не придумывай новые формулы, "
        "определения или факты, которых нет в тексте.\n"
        "Нужно сгенерировать несколько проверяемых задач (с правильными ответами).\n\n"
        "ОБЯЗАТЕЛЬНО используй разметку markdown и LaTeX для математических выражений "
        "в полях title, statement, choices[].text и explanation, когда в задаче есть формулы "
        "или выражения. Для формул используй LaTeX-нотацию: $...$ для встроенных формул и "
        "$$...$$ для выделенных формул в отдельной строке. Например: $x^2 + 3x + 2 = 0$, "
        "$$S = \\pi r^2$$. Допустимо использовать Unicode-символы вроде √, π, ≤, ≥, ±, ∑, ∞ и т.п.\n\n"
        "ОСОБЕННО для задач сложности \"hard\" чаще используй тип \"short_text\" "
        "с заполненным полем text_answer (а не только выбор одного из вариантов). "
        "Текст ответа (text_answer) должен быть таким, чтобы ученик мог ввести его "
        "обычной клавиатурой без специальных математических символов: используй цифры, "
        "буквы и стандартные знаки (+, -, *, /, запятая, точка, пробел и т.п.). "
        "Специальные символы и LaTeX можно свободно использовать в условии, вариантах "
        "ответа и объяснении, но НЕ обязательно в самом тексте ответа. "
        "Не пиши в условии или подсказках, что ученик обязан вводить ответ в формате LaTeX "
        "или в виде кода формулы — всегда подразумевай обычный человекочитаемый ответ "
        "в привычной школьной записи (например, 1/2, 0.5, 2πr и т.п.).\n\n"
        "Если передан намёк на распределение по сложностям (difficulty_quota), "
        "постарайся соблюдать указанное количество лёгких, средних и сложных задач. "
        "Если такого намёка нет, старайся распределять задачи по сложностям "
        "примерно поровну между easy, medium и hard.\n\n"
        "Формат ответа — ЧИСТЫЙ JSON БЕЗ комментариев и текста вокруг. "
        "Ответ ДОЛЖЕН быть строго валидным JSON-объектом UTF-8 со структурой:\n"
        "{\n"
        '  \"problems\": [\n'
        "    {\n"
        '      \"title\": \"...\",\n'
        '      \"statement\": \"...\",\n'
        '      \"type\": \"single_choice\" | \"multiple_choice\" | \"short_text\",\n'
        '      \"difficulty\": \"easy\" | \"medium\" | \"hard\",\n'
        '      \"choices\": [ { \"text\": \"...\", \"is_correct\": true | false }, ... ],\n'
        '      \"text_answer\": \"...\",   /* только для short_text */\n'
        '      \"explanation\": \"...\"    /* короткое объяснение решения (опционально) */\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "ВНИМАНИЕ:\n"
        "- Не добавляй никакого текста до или после JSON-объекта.\n"
        "- Внутри JSON не используй комментарии //, только строки.\n"
        "- Все строки должны быть корректно экранированными JSON-строками.\n"
        "- Условие (statement) не содержит готового ответа.\n"
        "- Для single_choice / multiple_choice есть минимум один вариант с is_correct=true.\n"
        "- Для short_text заполни text_answer.\n"
        "- Не используй тип numeric и другие нестандартные типы.\n"
        "- Количество задач не больше запрошенного.\n"
        "- Задачи внутри массива problems НЕ должны дублировать друг друга: формулировки и числа в условиях должны различаться.\n"
    )

    context = "\n\n---\n\n".join(chunks)

    difficulty_hint = ""
    if difficulty_quota:
        parts: list[str] = []
        easy_n = difficulty_quota.get("easy") or 0
        medium_n = difficulty_quota.get("medium") or 0
        hard_n = difficulty_quota.get("hard") or 0
        if easy_n > 0:
            parts.append(f"лёгких — {easy_n}")
        if medium_n > 0:
            parts.append(f"средних — {medium_n}")
        if hard_n > 0:
            parts.append(f"сложных — {hard_n}")
        if parts:
            difficulty_hint = (
                "По уровням сложности нужно примерно следующее распределение задач: "
                + ", ".join(parts)
                + ".\n"
            )

    user_prompt = (
        f"Тема: {topic_title}\n"
        f"Нужно сгенерировать до {count} задач по этой теме.\n"
        f"{difficulty_hint}\n"
        f"Контекст учебника (используй только его):\n{context}"
    )

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
        await log_llm_token_usage(
            request_type="problems.generate_rag_problems",
            model_name=settings.LLM_MODEL_NAME,
            input_tokens=None,
            output_tokens=None,
            total_tokens=None,
            request_meta={
                "topic_title": topic_title,
                "chunks_count": len(chunks),
                "requested_count": count,
                "difficulty_quota": dict(difficulty_quota or {}),
            },
            success=False,
            error_text=str(exc),
        )
        logger.warning("LLM RAG problem generation failed: %s", exc)
        return []

    input_tokens, output_tokens, total_tokens = extract_openai_token_usage(response)
    await log_llm_token_usage(
        request_type="problems.generate_rag_problems",
        model_name=settings.LLM_MODEL_NAME,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        request_meta={
            "topic_title": topic_title,
            "chunks_count": len(chunks),
            "requested_count": count,
            "difficulty_quota": dict(difficulty_quota or {}),
        },
    )

    content = response.choices[0].message.content or ""
    raw = content.strip()
    if not raw:
        return []

    json_block = _extract_json_block(raw) or raw

    try:
        data = json.loads(json_block)
    except Exception as exc:  # pragma: no cover - защитный код
        logger.warning("Failed to parse JSON from LLM RAG problems: %s; content=%r", exc, raw[:5000])
        return []

    # Разбираем JSON более устойчиво: валидируем каждую задачу по отдельности,
    # чтобы одна битая задача не ломала весь результат.
    raw_items: list[dict] = []
    if isinstance(data, dict) and "problems" in data and isinstance(data["problems"], list):
        raw_items = data["problems"]
    elif isinstance(data, list):
        raw_items = data
    elif isinstance(data, dict):
        raw_items = [data]
    else:
        logger.warning("Unexpected JSON structure for RAG problems: %r", type(data))
        return []

    problems: list[GeneratedProblem] = []
    for idx, item in enumerate(raw_items):
        try:
            problems.append(GeneratedProblem.model_validate(item))
        except ValidationError as exc:  # pragma: no cover - защитный код
            logger.warning("Validation error for RAG problem #%s: %s; item=%r", idx, exc, item)
            continue

    if not problems:
        # Для диагностики выводим «сырое» содержимое ответа модели.
        snippet = raw[:5000]
        logger.warning(
            "LLM RAG problems empty after validation; raw_response_snippet=%r",
            snippet,
        )
        # Дублируем в stdout, чтобы точно увидеть в терминале разработки.
        print("\n===== LLM RAG RAW RESPONSE (snippet) =====")
        print(snippet)
        print("===== END LLM RAG RAW RESPONSE =====\n")
        return []

    return problems[:count]

