from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequest, Forbidden, NotFound, TooManyRequests
from app.settings import settings
from app.modules.chat.data.models import (
    ChatContextType,
    ChatMessageRole,
)
from app.modules.chat.data.repo import ChatRepo
from app.modules.chat.application.context_builder import (
    build_lesson_context,
    build_problem_context,
)
from app.modules.chat.application.chains import (
    stream_lesson_chat,
    stream_problem_hint,
    stream_rag_chat,
)

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ChatRepo(session)

    async def get_or_create_conversation(
        self,
        user_id: uuid.UUID,
        context_type: ChatContextType,
        lesson_id: uuid.UUID | None,
        problem_id: uuid.UUID | None,
    ):
        # Validate params
        if context_type == ChatContextType.LESSON and lesson_id is None:
            raise BadRequest("lesson_id required for lesson context")
        if context_type == ChatContextType.PROBLEM and problem_id is None:
            raise BadRequest("problem_id required for problem context")

        existing = await self.repo.find_conversation(
            user_id=user_id,
            context_type=context_type,
            lesson_id=lesson_id,
            problem_id=problem_id,
        )
        if existing:
            return existing

        conv = await self.repo.create_conversation(
            user_id=user_id,
            context_type=context_type,
            lesson_id=lesson_id,
            problem_id=problem_id,
        )
        await self.session.commit()
        return conv

    async def verify_ownership(self, conversation_id: uuid.UUID, user_id: uuid.UUID):
        conv = await self.repo.get_conversation(conversation_id)
        if not conv:
            raise NotFound("Conversation not found")
        if conv.user_id != user_id:
            raise Forbidden("Not your conversation")
        return conv

    async def get_messages(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        before_id: uuid.UUID | None = None,
    ):
        await self.verify_ownership(conversation_id, user_id)
        return await self.repo.list_messages(
            conversation_id,
            before_id=before_id,
            limit=50,
        )

    def _seconds_until_midnight_utc(self) -> int:
        now = datetime.now(timezone.utc)
        midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
        next_midnight = midnight + timedelta(days=1)
        return int((next_midnight - now).total_seconds())

    async def _check_daily_limit(self, user_id: uuid.UUID, context_type: ChatContextType) -> None:
        # Limits disabled — usage still tracked for analytics
        pass

    async def send_message(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        content: str,
    ):
        """Generator that yields SSE events for a user message."""
        conv = await self.verify_ownership(conversation_id, user_id)
        await self._check_daily_limit(user_id, conv.context_type)

        # Save user message
        await self.repo.add_message(
            conversation_id=conversation_id,
            role=ChatMessageRole.USER,
            content=content,
        )

        # Increment daily counter
        if conv.context_type == ChatContextType.LESSON:
            await self.repo.increment_lesson_count(user_id)
        else:
            await self.repo.increment_hint_count(user_id)

        # Build context
        if conv.context_type == ChatContextType.LESSON:
            context = await build_lesson_context(self.session, conv.lesson_id)
        else:
            context = await build_problem_context(self.session, conv.problem_id, user_id)

        # Get conversation history
        all_messages = await self.repo.get_all_messages_for_context(conversation_id)
        # Exclude the just-added user message (it's the input)
        history = [
            {"role": msg.role.value, "content": msg.content}
            for msg in all_messages[:-1]
        ]

        await self.repo.touch_conversation(conversation_id)
        await self.session.commit()

        # Stream response
        full_response = []
        try:
            if conv.context_type == ChatContextType.LESSON:
                stream = stream_lesson_chat(context, history, content)
            else:
                stream = stream_problem_hint(context, history, content)

            async for token in stream:
                full_response.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"

            # Save assistant message
            assistant_content = "".join(full_response)
            msg = await self.repo.add_message(
                conversation_id=conversation_id,
                role=ChatMessageRole.ASSISTANT,
                content=assistant_content,
            )
            await self.session.commit()
            yield f"data: {json.dumps({'done': True, 'message_id': str(msg.id)})}\n\n"

        except Exception as exc:
            logger.error("LLM streaming error: %s", exc)
            if full_response:
                # Mid-stream failure: save partial
                partial = "".join(full_response) + " [generation interrupted]"
                await self.repo.add_message(
                    conversation_id=conversation_id,
                    role=ChatMessageRole.ASSISTANT,
                    content=partial,
                )
                await self.session.commit()
            yield f"event: error\ndata: {json.dumps({'message': 'AI response failed. Please try again.'})}\n\n"

    async def send_hint(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
    ):
        """Generator that yields SSE events for a hint request."""
        conv = await self.verify_ownership(conversation_id, user_id)

        if conv.context_type != ChatContextType.PROBLEM:
            raise BadRequest("Hints are only available for problem conversations")

        await self._check_daily_limit(user_id, ChatContextType.PROBLEM)

        # Increment hint counter
        await self.repo.increment_hint_count(user_id)

        # Build context
        context = await build_problem_context(self.session, conv.problem_id, user_id)

        # Get conversation history
        all_messages = await self.repo.get_all_messages_for_context(conversation_id)
        history = [
            {"role": msg.role.value, "content": msg.content}
            for msg in all_messages
        ]

        await self.repo.touch_conversation(conversation_id)
        await self.session.commit()

        # Stream hint
        full_response = []
        try:
            stream = stream_problem_hint(context, history)

            async for token in stream:
                full_response.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"

            assistant_content = "".join(full_response)
            msg = await self.repo.add_message(
                conversation_id=conversation_id,
                role=ChatMessageRole.ASSISTANT,
                content=assistant_content,
                is_hint=True,
            )
            await self.session.commit()
            yield f"data: {json.dumps({'done': True, 'message_id': str(msg.id)})}\n\n"

        except Exception as exc:
            logger.error("LLM hint streaming error: %s", exc)
            if full_response:
                partial = "".join(full_response) + " [generation interrupted]"
                await self.repo.add_message(
                    conversation_id=conversation_id,
                    role=ChatMessageRole.ASSISTANT,
                    content=partial,
                    is_hint=True,
                )
                await self.session.commit()
            yield f"event: error\ndata: {json.dumps({'message': 'AI response failed. Please try again.'})}\n\n"

    async def send_rag_message(self, user_id: uuid.UUID, content: str):
        """RAG-based chat — search user's documents and stream response."""
        from app.modules.knowledge.application.embedding import embed
        from app.modules.knowledge.data.repo import KnowledgeRepo

        # Search user's documents
        query_embedding = embed(content)
        knowledge_repo = KnowledgeRepo(self.session)
        chunks = await knowledge_repo.search(
            query_embedding,
            subject_code=f"user:{user_id}",
            k=8,
        )

        if chunks:
            context = "\n\n---\n\n".join(chunk.content for chunk in chunks)
        else:
            context = "(У вас пока нет загруженных материалов. Загрузите файлы через кнопку выше.)"

        full_response = []
        try:
            stream = stream_rag_chat(context, [], content)
            async for token in stream:
                full_response.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"

            assistant_content = "".join(full_response)
            yield f"data: {json.dumps({'done': True, 'message_id': 'rag'})}\n\n"

        except Exception as exc:
            logger.error("RAG streaming error: %s", exc)
            yield f"event: error\ndata: {json.dumps({'message': 'Ошибка AI. Попробуйте снова.'})}\n\n"

    async def get_usage(self, user_id: uuid.UUID) -> dict:
        usage = await self.repo.get_or_create_daily_usage(user_id)
        now = datetime.now(timezone.utc)
        resets_at = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        return {
            "lesson": {
                "used": usage.lesson_message_count,
                "limit": settings.CHAT_LESSON_DAILY_LIMIT,
            },
            "hint": {
                "used": usage.hint_message_count,
                "limit": settings.CHAT_HINT_DAILY_LIMIT,
            },
            "resets_at": resets_at.isoformat(),
        }
