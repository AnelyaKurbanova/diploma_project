"""add user friend requests table

Revision ID: a9b8c7d6e5f4
Revises: f1a2b3c4d5e6
Create Date: 2026-02-18 15:20:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


revision = "a9b8c7d6e5f4"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_friend_requests",
        sa.Column("requester_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("target_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint("requester_id <> target_id", name="ck_user_friend_requests_not_self"),
        sa.PrimaryKeyConstraint("requester_id", "target_id"),
    )
    op.create_index(
        "ix_user_friend_requests_requester_id",
        "user_friend_requests",
        ["requester_id"],
        unique=False,
    )
    op.create_index(
        "ix_user_friend_requests_target_id",
        "user_friend_requests",
        ["target_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_user_friend_requests_target_id", table_name="user_friend_requests")
    op.drop_index("ix_user_friend_requests_requester_id", table_name="user_friend_requests")
    op.drop_table("user_friend_requests")
