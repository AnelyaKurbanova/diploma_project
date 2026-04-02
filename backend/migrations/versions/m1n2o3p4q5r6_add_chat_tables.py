"""add chat tables

Revision ID: m1n2o3p4q5r6
Revises: 232698c419db
Create Date: 2026-03-16
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "m1n2o3p4q5r6"
down_revision: Union[str, None] = "232698c419db"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enum types via raw SQL to avoid double-create issues
    op.execute("CREATE TYPE chat_context_type AS ENUM ('lesson', 'problem')")
    op.execute("CREATE TYPE chat_message_role AS ENUM ('user', 'assistant')")

    chat_context_type = postgresql.ENUM("lesson", "problem", name="chat_context_type", create_type=False)
    chat_message_role = postgresql.ENUM("user", "assistant", name="chat_message_role", create_type=False)

    # chat_conversations
    op.create_table(
        "chat_conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("context_type", chat_context_type, nullable=False),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=True),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_chat_conversations_user_id", "chat_conversations", ["user_id"])
    # Partial unique indexes (PostgreSQL NULL != NULL workaround)
    op.execute(
        "CREATE UNIQUE INDEX uq_chat_conv_lesson "
        "ON chat_conversations (user_id, lesson_id) "
        "WHERE context_type = 'lesson'"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_chat_conv_problem "
        "ON chat_conversations (user_id, problem_id) "
        "WHERE context_type = 'problem'"
    )

    # chat_messages
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("chat_conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", chat_message_role, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_hint", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_chat_messages_conv_created", "chat_messages", ["conversation_id", "created_at"])

    # chat_daily_usage
    op.create_table(
        "chat_daily_usage",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("lesson_message_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("hint_message_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index("ix_chat_daily_usage_user_id", "chat_daily_usage", ["user_id"])
    op.create_unique_constraint("uq_chat_daily_usage_user_date", "chat_daily_usage", ["user_id", "date"])


def downgrade() -> None:
    op.drop_table("chat_daily_usage")
    op.drop_index("ix_chat_messages_conv_created", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.execute("DROP INDEX IF EXISTS uq_chat_conv_problem")
    op.execute("DROP INDEX IF EXISTS uq_chat_conv_lesson")
    op.drop_index("ix_chat_conversations_user_id", table_name="chat_conversations")
    op.drop_table("chat_conversations")
    sa.Enum(name="chat_message_role").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="chat_context_type").drop(op.get_bind(), checkfirst=True)
