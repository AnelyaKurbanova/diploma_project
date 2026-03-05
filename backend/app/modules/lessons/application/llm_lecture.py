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
            timeout=settings.LLM_NORMALIZER_TIMEOUT_SEC * 4,
        )
    return _client


async def generate_lecture_from_context(
    topic_title: str,
    chunks: list[str],
) -> str | None:
    """Generate lecture text from RAG context. Uses only provided chunks."""

    if not settings.OPENAI_API_KEY:
        logger.debug("OPENAI_API_KEY not configured – skipping lecture generation")
        return None

    topic_title = topic_title.strip()
    if not topic_title or not chunks:
        return None

    client = _get_client()

    system_prompt = (
        "Ты составляешь учебную лекцию по школьной программе на русском языке.\n"
        "Используй ТОЛЬКО информацию из контекста ниже. Не придумывай факты, определения или формулы.\n"
        "Формулы записывай в LaTeX: $...$ для инлайновых, $$...$$ для выносных.\n"
        "Структурируй текст: определения, правила, примеры. Пиши понятно и по делу.\n"
        "Если в контексте нет достаточной информации по теме — напиши об этом кратко.\n"
        "Не добавляй в конец лекции замечания, мета-комментарии вроде «в лекции использованы определения из учебника» и т.п. Заканчивай последним разделом с примерами или правилами."
    )

    context = "\n\n---\n\n".join(chunks)
    user_prompt = f"Тема лекции: {topic_title}\n\nКонтекст из учебника:\n\n{context}"

    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=8192,
        )
        choice = response.choices[0] if response.choices else None
        if not choice:
            logger.warning("LLM lecture: API returned no choices")
            return None
        content = choice.message.content or ""
        finish_reason = getattr(choice, "finish_reason", None)
        result = content.strip() or None
        if not result:
            logger.warning(
                "LLM lecture: empty or whitespace-only content, finish_reason=%s",
                finish_reason,
            )
        return result
    except Exception as exc:
        logger.warning("LLM lecture generation failed: %s", exc)
        return None
