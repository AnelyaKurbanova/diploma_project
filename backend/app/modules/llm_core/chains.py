from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage


def messages_to_langchain(messages: list[dict]) -> list[HumanMessage | AIMessage]:
    """Convert DB message dicts [{role, content}] to LangChain message objects."""
    result = []
    for msg in messages:
        if msg["role"] == "user":
            result.append(HumanMessage(content=msg["content"]))
        else:
            result.append(AIMessage(content=msg["content"]))
    return result
