"""ensure problem_images table exists

Revision ID: d9e8f7a6b5c4
Revises: c8d7e6f5a4b3
Create Date: 2026-02-19 12:05:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "d9e8f7a6b5c4"
down_revision = "c8d7e6f5a4b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS problem_images (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
              url VARCHAR(1024) NOT NULL,
              order_no INTEGER NOT NULL DEFAULT 0,
              alt_text VARCHAR(255)
            );
            """
        )
    )

    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname = 'ix_problem_images_problem_id'
              ) THEN
                CREATE INDEX ix_problem_images_problem_id ON problem_images (problem_id);
              END IF;
            END
            $$;
            """
        )
    )

    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'uq_problem_image_order'
              ) THEN
                ALTER TABLE problem_images
                  ADD CONSTRAINT uq_problem_image_order UNIQUE (problem_id, order_no);
              END IF;
            END
            $$;
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS problem_images CASCADE;"))
