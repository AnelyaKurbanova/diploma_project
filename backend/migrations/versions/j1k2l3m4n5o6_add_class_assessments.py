"""add class assessments

Revision ID: j1k2l3m4n5o6
Revises: h3i4j5k6l7m8
Create Date: 2026-02-27 14:30:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "j1k2l3m4n5o6"
down_revision = "h3i4j5k6l7m8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "class_assessments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("time_limit_min", sa.Integer(), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_class_assessments_class_id", "class_assessments", ["class_id"])
    op.create_index("ix_class_assessments_created_by", "class_assessments", ["created_by"])
    op.create_index("ix_class_assessments_is_published", "class_assessments", ["is_published"])

    op.create_table(
        "class_assessment_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("assessment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_no", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("points", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["assessment_id"], ["class_assessments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("assessment_id", "problem_id", name="uq_class_assessment_problem"),
    )
    op.create_index("ix_class_assessment_items_assessment_id", "class_assessment_items", ["assessment_id"])
    op.create_index("ix_class_assessment_items_problem_id", "class_assessment_items", ["problem_id"])


def downgrade() -> None:
    op.drop_index("ix_class_assessment_items_problem_id", table_name="class_assessment_items")
    op.drop_index("ix_class_assessment_items_assessment_id", table_name="class_assessment_items")
    op.drop_table("class_assessment_items")

    op.drop_index("ix_class_assessments_is_published", table_name="class_assessments")
    op.drop_index("ix_class_assessments_created_by", table_name="class_assessments")
    op.drop_index("ix_class_assessments_class_id", table_name="class_assessments")
    op.drop_table("class_assessments")
