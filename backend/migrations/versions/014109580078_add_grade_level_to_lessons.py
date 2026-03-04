"""add_grade_level_to_lessons

Revision ID: 014109580078
Revises: h3i4j5k6l7m8
Create Date: 2026-03-03 15:30:04.085047

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '014109580078'
down_revision = 'h3i4j5k6l7m8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lessons",
        sa.Column("grade_level", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_lessons_grade_level",
        "lessons",
        ["grade_level"],
    )


def downgrade() -> None:
    op.drop_index("ix_lessons_grade_level", table_name="lessons")
    op.drop_column("lessons", "grade_level")
