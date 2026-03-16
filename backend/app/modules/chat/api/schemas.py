from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.modules.chat.data.models import ChatContextType, ChatMessageRole


class ConversationCreate(BaseModel):
    context_type: ChatContextType
    lesson_id: uuid.UUID | None = None
    problem_id: uuid.UUID | None = None


class ConversationOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    context_type: ChatContextType
    lesson_id: uuid.UUID | None
    problem_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    role: ChatMessageRole
    content: str
    is_hint: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str


class UsageBucket(BaseModel):
    used: int
    limit: int


class UsageOut(BaseModel):
    lesson: UsageBucket
    hint: UsageBucket
    resets_at: str
