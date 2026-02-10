"""add onboarding primary_goal and interested_subjects

Revision ID: a1b2c3d4e5f6
Revises: 8da4973a9470
Create Date: 2026-02-10

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "a1b2c3d4e5f6"
down_revision = "8da4973a9470"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column("primary_goal", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "user_profiles",
        sa.Column("interested_subjects", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_profiles", "interested_subjects")
    op.drop_column("user_profiles", "primary_goal")
