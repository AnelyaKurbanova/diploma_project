from __future__ import annotations

import logging

from app.modules.llm_usage.application.tracker import (
    extract_openai_token_usage,
    log_llm_token_usage,
)
from app.settings import settings

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
Вы — строгий нормализатор текста для ответов в образовательных тестах.
Ваша ЕДИНСТВЕННАЯ задача — преобразовать свободный ответ студента в краткую каноническую форму.

ФОРМАТ ВЫВОДА:
- Выводите ТОЛЬКО нормализованное значение в ОДНОЙ строке, без пояснений.
- Если ответ содержит число — используйте точку как десятичный разделитель (не запятую).
- Если ответ содержит единицы измерения — ставьте один пробел между числом и единицей.
- Единицы измерения записывайте в латинской краткой форме: km/h, m/s, kg, N, J, W, m^2, cm^3 и т.п.
- НИКОГДА не меняйте сами единицы измерения: не заменяйте км/с на км/ч, секунды на часы, метры на километры и т.п. Менять можно только способ записи (кириллица → латиница, пробелы), но не смысл единицы.

ПРИМЕРЫ:
- «тридцать шесть километров в час» → «36 km/h»
- «36км/ч» → «36 km/h»
- «36 км/ч» → «36 km/h»
- «36км/с» → «36 km/s» (единица «в секунду» не менять на «в час»)
- «три пятых» → «3/5»
- «одна целая два десятых» → «1.2»
- «12 метров в секунду» → «12 m/s»
- «5 ньютонов» → «5 N»
- «100 ватт» → «100 W»
- «пифагоров теорема» → «пифагоров теорема»

ЗАПРЕЩЕНО:
- НЕ решайте, не вычисляйте и не выводите значения.
- НЕ добавляйте информацию, которой нет в исходном ответе.
- НЕ меняйте числовое значение (только формат записи).
- НЕ придумывайте единицы измерения, если их нет в ответе.
- НЕ заменяйте одни единицы измерения на другие (км/с ↔ км/ч, с ↔ ч, м ↔ км и т.д.) — только переводите написание в латиницу и форматируйте пробелы.

Если ввод уже в канонической форме — верните его без изменений.
"""

_client = None


def _get_client():
    global _client
    if _client is None:
        from openai import AsyncOpenAI

        _client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=settings.LLM_NORMALIZER_TIMEOUT_SEC,
        )
    return _client


async def normalize_answer_via_llm(raw_answer: str) -> str | None:
    raw = raw_answer.strip()
    if not raw:
        return None

    if not settings.OPENAI_API_KEY:
        logger.debug("OPENAI_API_KEY not configured – skipping LLM normalization")
        return None

    try:
        client = _get_client()
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL_NAME,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": raw},
            ],
            max_completion_tokens=64,
        )
        input_tokens, output_tokens, total_tokens = extract_openai_token_usage(response)
        await log_llm_token_usage(
            request_type="submissions.normalize_answer",
            model_name=settings.LLM_MODEL_NAME,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            request_meta={
                "raw_answer_len": len(raw),
            },
        )
        result = response.choices[0].message.content
        if result:
            result = result.strip()
        logger.debug("LLM normalize: %r → %r", raw, result)
        return result or None
    except Exception as exc:
        await log_llm_token_usage(
            request_type="submissions.normalize_answer",
            model_name=settings.LLM_MODEL_NAME,
            input_tokens=None,
            output_tokens=None,
            total_tokens=None,
            request_meta={
                "raw_answer_len": len(raw),
            },
            success=False,
            error_text=str(exc),
        )
        logger.warning("LLM normalization request failed: %s", exc)
        return None
