"""add grade_level to subjects

Revision ID: h3i4j5k6l7m8
Revises: 12c3462baf21
Create Date: 2026-02-26

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "h3i4j5k6l7m8"
down_revision = "12c3462baf21"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "subjects",
        sa.Column("grade_level", sa.Integer(), nullable=True),
    )
    op.create_index(op.f("ix_subjects_grade_level"), "subjects", ["grade_level"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_subjects_grade_level"), table_name="subjects")
    op.drop_column("subjects", "grade_level")
