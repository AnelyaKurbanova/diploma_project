from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.chat.data.models import (
    ChatContextType,
    ChatConversationModel,
    ChatDailyUsageModel,
    ChatMessageModel,
    ChatMessageRole,
)


class ChatRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_conversation(self, conversation_id: uuid.UUID) -> ChatConversationModel | None:
        return await self.session.get(ChatConversationModel, conversation_id)

    async def find_conversation(
        self,
        user_id: uuid.UUID,
        context_type: ChatContextType,
        lesson_id: uuid.UUID | None = None,
        problem_id: uuid.UUID | None = None,
    ) -> ChatConversationModel | None:
        stmt = select(ChatConversationModel).where(
            ChatConversationModel.user_id == user_id,
            ChatConversationModel.context_type == context_type,
        )
        if context_type == ChatContextType.LESSON:
            stmt = stmt.where(ChatConversationModel.lesson_id == lesson_id)
        else:
            stmt = stmt.where(ChatConversationModel.problem_id == problem_id)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def create_conversation(
        self,
        *,
        user_id: uuid.UUID,
        context_type: ChatContextType,
        lesson_id: uuid.UUID | None = None,
        problem_id: uuid.UUID | None = None,
    ) -> ChatConversationModel:
        row = ChatConversationModel(
            user_id=user_id,
            context_type=context_type,
            lesson_id=lesson_id,
            problem_id=problem_id,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def touch_conversation(self, conversation_id: uuid.UUID) -> None:
        stmt = (
            update(ChatConversationModel)
            .where(ChatConversationModel.id == conversation_id)
            .values(updated_at=datetime.now(timezone.utc))
        )
        await self.session.execute(stmt)

    async def add_message(
        self,
        *,
        conversation_id: uuid.UUID,
        role: ChatMessageRole,
        content: str,
        is_hint: bool = False,
    ) -> ChatMessageModel:
        row = ChatMessageModel(
            conversation_id=conversation_id,
            role=role,
            content=content,
            is_hint=is_hint,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def list_messages(
        self,
        conversation_id: uuid.UUID,
        *,
        before_id: uuid.UUID | None = None,
        limit: int = 50,
    ) -> list[ChatMessageModel]:
        stmt = (
            select(ChatMessageModel)
            .where(ChatMessageModel.conversation_id == conversation_id)
        )
        if before_id is not None:
            cursor_msg = await self.session.get(ChatMessageModel, before_id)
            if cursor_msg:
                stmt = stmt.where(
                    (ChatMessageModel.created_at < cursor_msg.created_at)
                    | (
                        (ChatMessageModel.created_at == cursor_msg.created_at)
                        & (ChatMessageModel.id < before_id)
                    )
                )
        stmt = stmt.order_by(
            ChatMessageModel.created_at.desc(),
            ChatMessageModel.id.desc(),
        ).limit(limit)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(reversed(rows))

    async def get_all_messages_for_context(
        self, conversation_id: uuid.UUID,
    ) -> list[ChatMessageModel]:
        stmt = (
            select(ChatMessageModel)
            .where(ChatMessageModel.conversation_id == conversation_id)
            .order_by(ChatMessageModel.created_at.asc())
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def get_or_create_daily_usage(
        self, user_id: uuid.UUID,
    ) -> ChatDailyUsageModel:
        today = datetime.now(timezone.utc).date()
        stmt = select(ChatDailyUsageModel).where(
            ChatDailyUsageModel.user_id == user_id,
            ChatDailyUsageModel.date == today,
        )
        row = (await self.session.execute(stmt)).scalar_one_or_none()
        if row is None:
            row = ChatDailyUsageModel(user_id=user_id, date=today)
            self.session.add(row)
            await self.session.flush()
        return row

    async def increment_lesson_count(self, user_id: uuid.UUID) -> None:
        usage = await self.get_or_create_daily_usage(user_id)
        usage.lesson_message_count += 1
        await self.session.flush()

    async def increment_hint_count(self, user_id: uuid.UUID) -> None:
        usage = await self.get_or_create_daily_usage(user_id)
        usage.hint_message_count += 1
        await self.session.flush()

    async def count_user_submissions(
        self, user_id: uuid.UUID, problem_id: uuid.UUID,
    ) -> int:
        from app.modules.submissions.data.models import SubmissionModel
        stmt = select(func.count()).where(
            SubmissionModel.user_id == user_id,
            SubmissionModel.problem_id == problem_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()
