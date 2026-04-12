from __future__ import annotations

import logging

from openai import AsyncOpenAI

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
        "Формулы — только в LaTeX: $...$ для инлайновых, $$...$$ для выносных (блок на отдельных строках).\n"
        "КРИТИЧНО: (1) выносную формулу открывай $$ и закрывай именно $$, не одним $; "
        "(2) инлайновую — ровно одним $ слева и одним $ справа, не смешивай $$ и $; "
        "(3) неравенства вроде 0<a<1, x<2 пиши только внутри $...$ или $$...$$, "
        "никогда не оставляй «цифра<буква» в обычном тексте — ломается сайт; "
        "(4) от русских слов до $ ставь пробел (например: «тогда $a>1$ и»).\n"
        "Не используй HTML. Структура: markdown (## заголовки, списки -).\n"
        "Если в контексте мало материала — напиши об этом кратко.\n"
        "Не пиши «Конец лекции», «см. выше», прочие мета-фразы. Финал — примеры или правила.\n"
        "Объясняй простым языком, по шагам."
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
        input_tokens, output_tokens, total_tokens = extract_openai_token_usage(response)
        await log_llm_token_usage(
            request_type="lessons.generate_lecture",
            model_name=settings.LLM_MODEL_NAME,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            request_meta={
                "topic_title": topic_title,
                "chunks_count": len(chunks),
            },
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
        await log_llm_token_usage(
            request_type="lessons.generate_lecture",
            model_name=settings.LLM_MODEL_NAME,
            input_tokens=None,
            output_tokens=None,
            total_tokens=None,
            request_meta={
                "topic_title": topic_title,
                "chunks_count": len(chunks),
            },
            success=False,
            error_text=str(exc),
        )
        logger.warning("LLM lecture generation failed: %s", exc)
        return None
