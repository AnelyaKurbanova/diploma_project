from __future__ import annotations

import logging
from typing import Any, Mapping

from app.data.db.session import SessionLocal
from app.modules.llm_usage.data.models import LLMTokenUsageModel

logger = logging.getLogger(__name__)


def extract_openai_token_usage(response: Any) -> tuple[int | None, int | None, int | None]:
    """Extract token usage across different OpenAI SDK response formats."""
    usage = getattr(response, "usage", None)
    if usage is None:
        return None, None, None

    input_tokens = (
        getattr(usage, "prompt_tokens", None)
        or getattr(usage, "input_tokens", None)
    )
    output_tokens = (
        getattr(usage, "completion_tokens", None)
        or getattr(usage, "output_tokens", None)
    )
    total_tokens = getattr(usage, "total_tokens", None)

    if hasattr(usage, "model_dump"):
        try:
            usage_dict = usage.model_dump()
            input_tokens = input_tokens or usage_dict.get("prompt_tokens") or usage_dict.get("input_tokens")
            output_tokens = output_tokens or usage_dict.get("completion_tokens") or usage_dict.get("output_tokens")
            total_tokens = total_tokens or usage_dict.get("total_tokens")
        except Exception:  # pragma: no cover - defensive
            pass

    if total_tokens is None and (input_tokens is not None or output_tokens is not None):
        total_tokens = (input_tokens or 0) + (output_tokens or 0)

    return _as_int(input_tokens), _as_int(output_tokens), _as_int(total_tokens)


def _as_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except Exception:  # pragma: no cover - defensive
        return None


async def log_llm_token_usage(
    *,
    request_type: str,
    model_name: str,
    input_tokens: int | None,
    output_tokens: int | None,
    total_tokens: int | None,
    request_meta: Mapping[str, Any] | None = None,
    success: bool = True,
    error_text: str | None = None,
    provider: str = "openai",
    endpoint: str = "chat.completions.create",
) -> None:
    """Persist LLM token usage without breaking main business flow."""
    payload = dict(request_meta or {})
    if total_tokens is None and (input_tokens is not None or output_tokens is not None):
        total_tokens = (input_tokens or 0) + (output_tokens or 0)

    try:
        async with SessionLocal() as session:
            row = LLMTokenUsageModel(
                provider=provider,
                model_name=model_name,
                request_type=request_type,
                endpoint=endpoint,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                success=success,
                error_text=(error_text or None),
                request_meta=payload,
            )
            session.add(row)
            await session.commit()
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(
            "Failed to persist llm_token_usage for request_type=%s: %s",
            request_type,
            exc,
        )
