"""ensure canonical_answer exists in problem_answer_keys

Revision ID: c8d7e6f5a4b3
Revises: b7c6d5e4f3a2
Create Date: 2026-02-19 11:40:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "c8d7e6f5a4b3"
down_revision = "b7c6d5e4f3a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'problem_answer_keys'
                  AND column_name = 'canonical_answer'
              ) THEN
                ALTER TABLE problem_answer_keys
                  ADD COLUMN canonical_answer VARCHAR(512);
              END IF;
            END
            $$;
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'problem_answer_keys'
                  AND column_name = 'canonical_answer'
              ) THEN
                ALTER TABLE problem_answer_keys
                  DROP COLUMN canonical_answer;
              END IF;
            END
            $$;
            """
        )
    )
