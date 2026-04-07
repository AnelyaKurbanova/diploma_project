"""add user notifications

Revision ID: r8s9t0u1v2w3
Revises: n2o3p4q5r6s7, q7w8e9r0t1y2
Create Date: 2026-04-04 13:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


revision = "r8s9t0u1v2w3"
down_revision = ("n2o3p4q5r6s7", "q7w8e9r0t1y2")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_notifications",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("payload", pg.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_user_notifications_user_id_created_at",
        "user_notifications",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_user_notifications_user_id_is_read",
        "user_notifications",
        ["user_id", "is_read"],
        unique=False,
    )
    op.create_index(
        "ix_user_notifications_actor_user_id",
        "user_notifications",
        ["actor_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_user_notifications_actor_user_id", table_name="user_notifications")
    op.drop_index("ix_user_notifications_user_id_is_read", table_name="user_notifications")
    op.drop_index("ix_user_notifications_user_id_created_at", table_name="user_notifications")
    op.drop_table("user_notifications")
