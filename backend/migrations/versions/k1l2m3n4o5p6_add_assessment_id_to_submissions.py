"""add assessment_id to submissions

Revision ID: k1l2m3n4o5p6
Revises: j1k2l3m4n5o6
Create Date: 2026-03-04 18:10:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "k1l2m3n4o5p6"
down_revision = "j1k2l3m4n5o6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "submissions",
        sa.Column("assessment_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_submissions_assessment_id", "submissions", ["assessment_id"])
    op.create_foreign_key(
        "fk_submissions_assessment_id_class_assessments",
        "submissions",
        "class_assessments",
        ["assessment_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_submissions_assessment_id_class_assessments",
        "submissions",
        type_="foreignkey",
    )
    op.drop_index("ix_submissions_assessment_id", table_name="submissions")
    op.drop_column("submissions", "assessment_id")
