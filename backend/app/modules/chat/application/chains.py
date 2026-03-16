from __future__ import annotations

from typing import AsyncIterator

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.modules.llm_core.llm import get_chat_llm
from app.modules.llm_core.chains import messages_to_langchain


LESSON_SYSTEM_PROMPT = """\
You are a helpful and patient tutor for an educational platform.
You answer questions about the lesson material provided below.
Be clear, encouraging, and adapt your explanations to the student's level.
Respond in the same language the student uses.

--- LESSON CONTEXT ---
{context}
--- END CONTEXT ---"""

HINT_SYSTEM_PROMPT = """\
You are a Socratic tutor on an educational platform.
The student is working on a problem and needs guidance.
Guide them through reasoning steps toward the solution.
You MUST NOT provide the direct answer or reveal the correct option.
Ask leading questions, point out relevant concepts, and help them think.
Respond in the same language the student uses.

--- PROBLEM CONTEXT ---
{context}
--- END CONTEXT ---"""


async def stream_lesson_chat(
    context: str,
    history: list[dict],
    user_input: str,
) -> AsyncIterator[str]:
    """Stream tokens for a lesson chat message."""
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
    """Stream tokens for a problem hint message."""
    llm = get_chat_llm(streaming=True, temperature=0.7)

    messages = [SystemMessage(content=HINT_SYSTEM_PROMPT.format(context=context))]
    messages.extend(messages_to_langchain(history))

    if user_input:
        messages.append(HumanMessage(content=user_input))
    else:
        # Initial hint request — student clicked "Hint" button
        messages.append(HumanMessage(content="I'm stuck on this problem. Can you give me a hint to get started?"))

    async for chunk in llm.astream(messages):
        if chunk.content:
            yield chunk.content
