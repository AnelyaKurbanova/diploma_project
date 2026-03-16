from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder


def build_chat_prompt(system_template: str) -> ChatPromptTemplate:
    """Build a chat prompt with system message + conversation history + user input."""
    return ChatPromptTemplate.from_messages([
        ("system", system_template),
        MessagesPlaceholder("history"),
        ("human", "{input}"),
    ])
