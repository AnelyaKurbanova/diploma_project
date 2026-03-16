from __future__ import annotations

from langchain_openai import ChatOpenAI

from app.settings import settings


def get_chat_llm(*, streaming: bool = False, temperature: float = 0.7) -> ChatOpenAI:
    """Return a configured ChatOpenAI instance. Reusable across modules."""
    return ChatOpenAI(
        model=settings.LLM_MODEL_NAME,
        api_key=settings.OPENAI_API_KEY,
        streaming=streaming,
        temperature=temperature,
    )
