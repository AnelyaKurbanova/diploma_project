"""Add statement_normalized column and unique constraint for problems.

Revision ID: z1y2x3w4v5u6
Revises: 014109580078
Create Date: 2026-03-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "z1y2x3w4v5u6"
down_revision = "014109580078"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Add nullable column first so we can backfill existing rows.
    op.add_column(
        "problems",
        sa.Column("statement_normalized", sa.Text(), nullable=True),
    )

    # 2) Backfill using a simple normalization that matches the Python helper:
    # - trim outer whitespace
    # - normalize Windows/Mac newlines to '\n'
    # - collapse consecutive spaces/tabs into a single space
    op.execute(
        sa.text(
            """
            UPDATE problems
            SET statement_normalized = regexp_replace(
                regexp_replace(
                  regexp_replace(btrim(statement), E'\\r\\n', E'\\n', 'g'),
                  E'\\r', E'\\n', 'g'
                ),
                E'[ \\t]+',
                ' ',
                'g'
            )
            WHERE statement IS NOT NULL;
            """
        )
    )

    # 3) Make the column non-nullable.
    op.alter_column(
        "problems",
        "statement_normalized",
        nullable=False,
        existing_type=sa.Text(),
    )

    # 4) Add a unique constraint to prevent strict duplicates per topic.
    op.create_unique_constraint(
        "uq_problem_topic_statement_norm",
        "problems",
        ["topic_id", "statement_normalized"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_problem_topic_statement_norm",
        "problems",
        type_="unique",
    )
    op.drop_column("problems", "statement_normalized")

