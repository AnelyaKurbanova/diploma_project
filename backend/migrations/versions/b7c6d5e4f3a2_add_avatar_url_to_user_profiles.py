"""add avatar_url to user profiles

Revision ID: b7c6d5e4f3a2
Revises: a9b8c7d6e5f4
Create Date: 2026-02-18 16:05:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "b7c6d5e4f3a2"
down_revision = "a9b8c7d6e5f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_profiles", sa.Column("avatar_url", sa.String(length=2048), nullable=True))


def downgrade() -> None:
    op.drop_column("user_profiles", "avatar_url")
