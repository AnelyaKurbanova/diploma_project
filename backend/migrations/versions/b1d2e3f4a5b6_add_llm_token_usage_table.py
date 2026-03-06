"""add llm token usage table

Revision ID: b1d2e3f4a5b6
Revises: abcd1234ef01
Create Date: 2026-03-06
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b1d2e3f4a5b6"
down_revision: Union[str, None] = "abcd1234ef01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "llm_token_usage",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False, server_default=sa.text("'openai'")),
        sa.Column("model_name", sa.String(length=128), nullable=False),
        sa.Column("request_type", sa.String(length=128), nullable=False),
        sa.Column(
            "endpoint",
            sa.String(length=128),
            nullable=False,
            server_default=sa.text("'chat.completions.create'"),
        ),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("error_text", sa.Text(), nullable=True),
        sa.Column("request_meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_llm_token_usage_request_type", "llm_token_usage", ["request_type"])
    op.create_index("ix_llm_token_usage_created_at", "llm_token_usage", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_llm_token_usage_created_at", table_name="llm_token_usage")
    op.drop_index("ix_llm_token_usage_request_type", table_name="llm_token_usage")
    op.drop_table("llm_token_usage")
