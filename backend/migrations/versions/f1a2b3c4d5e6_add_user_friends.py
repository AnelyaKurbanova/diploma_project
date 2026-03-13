"""add user friends table

Revision ID: f1a2b3c4d5e6
Revises: e8f9a0b1c2d3
Create Date: 2026-02-18 12:15:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


revision = "f1a2b3c4d5e6"
down_revision = "e8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_friends",
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("friend_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["friend_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint("user_id <> friend_id", name="ck_user_friends_not_self"),
        sa.PrimaryKeyConstraint("user_id", "friend_id"),
    )
    op.create_index("ix_user_friends_user_id", "user_friends", ["user_id"], unique=False)
    op.create_index("ix_user_friends_friend_id", "user_friends", ["friend_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_friends_friend_id", table_name="user_friends")
    op.drop_index("ix_user_friends_user_id", table_name="user_friends")
    op.drop_table("user_friends")
