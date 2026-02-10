"""add school_id to user_profiles

Revision ID: c3d4e5f60718
Revises: b2c3d4e5f607
Create Date: 2026-02-10

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "c3d4e5f60718"
down_revision = "b2c3d4e5f607"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column("school_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_user_profiles_school_id_schools",
        "user_profiles",
        "schools",
        ["school_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_user_profiles_school_id_schools",
        "user_profiles",
        type_="foreignkey",
    )
    op.drop_column("user_profiles", "school_id")
