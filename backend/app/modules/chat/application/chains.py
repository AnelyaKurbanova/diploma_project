from __future__ import annotations

from typing import AsyncIterator

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.modules.llm_core.llm import get_chat_llm
from app.modules.llm_core.chains import messages_to_langchain


LESSON_SYSTEM_PROMPT = """\
Ты — терпеливый и дружелюбный AI-репетитор на образовательной платформе. Тебя зовут Aika.
Ты отвечаешь на вопросы по материалу урока, который приведён ниже.
Объясняй понятно, ободряй ученика, адаптируй объяснение под его уровень.
Всегда отвечай на русском языке. Используй markdown для форматирования.
Для математических формул используй LaTeX: inline формулы оборачивай в $...$, блочные в $$...$$.

--- МАТЕРИАЛ УРОКА ---
{context}
--- КОНЕЦ МАТЕРИАЛА ---"""

HINT_SYSTEM_PROMPT = """\
Ты — AI-репетитор на образовательной платформе. Тебя зовут Aika.
Ученик работает над задачей и просит помощи.
Помоги ему разобраться через наводящие вопросы и подсказки.
НЕ давай прямой ответ. Направляй ученика к решению через рассуждения.
Всегда отвечай на русском языке. Используй markdown для форматирования.
Для математических формул используй LaTeX: inline формулы оборачивай в $...$, блочные в $$...$$.

--- КОНТЕКСТ ЗАДАЧИ ---
{context}
--- КОНЕЦ КОНТЕКСТА ---"""

RAG_SYSTEM_PROMPT = """\
Ты — AI-помощник Aika на образовательной платформе.
Отвечай на вопросы ученика, используя контекст из загруженных материалов ниже.
Если в контексте нет информации для ответа, честно скажи об этом.
Всегда отвечай на русском языке. Используй markdown для форматирования.
Для математических формул используй LaTeX: inline формулы оборачивай в $...$, блочные в $$...$$.

--- МАТЕРИАЛЫ ---
{context}
--- КОНЕЦ МАТЕРИАЛОВ ---"""


async def stream_lesson_chat(
    context: str,
    history: list[dict],
    user_input: str,
) -> AsyncIterator[str]:
    llm = get_chat_llm(streaming=True, temperature=0.7)
    messages = [SystemMessage(content=LESSON_SYSTEM_PROMPT.format(context=context))]
    messages.extend(messages_to_langchain(history))
    messages.append(HumanMessage(content=user_input))
    async for chunk in llm.astream(messages):
        if chunk.content:
            yield chunk.content


async def stream_problem_hint(
    context: str,
    history: list[dict],
    user_input: str | None = None,
) -> AsyncIterator[str]:
    llm = get_chat_llm(streaming=True, temperature=0.7)
    messages = [SystemMessage(content=HINT_SYSTEM_PROMPT.format(context=context))]
    messages.extend(messages_to_langchain(history))
    if user_input:
        messages.append(HumanMessage(content=user_input))
    else:
        messages.append(HumanMessage(content="Я не могу решить эту задачу. Помоги мне разобраться, дай подсказку."))
    async for chunk in llm.astream(messages):
        if chunk.content:
            yield chunk.content


async def stream_rag_chat(
    context: str,
    history: list[dict],
    user_input: str,
) -> AsyncIterator[str]:
    llm = get_chat_llm(streaming=True, temperature=0.7)
    messages = [SystemMessage(content=RAG_SYSTEM_PROMPT.format(context=context))]
    messages.extend(messages_to_langchain(history))
    messages.append(HumanMessage(content=user_input))
    async for chunk in llm.astream(messages):
        if chunk.content:
            yield chunk.content
