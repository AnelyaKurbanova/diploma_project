"""add lesson status workflow

Revision ID: e8f9a0b1c2d3
Revises: 161990f656a1
Create Date: 2026-02-17 17:45:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


# revision identifiers, used by Alembic.
revision = "e8f9a0b1c2d3"
down_revision = "161990f656a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'lesson_status'
              ) THEN
                CREATE TYPE lesson_status AS ENUM ('draft', 'pending_review', 'published', 'archived');
              END IF;
            END
            $$;
            """
        )
    )

    lesson_status_enum = pg.ENUM(
        "draft",
        "pending_review",
        "published",
        "archived",
        name="lesson_status",
        create_type=False,
    )

    op.add_column(
        "lessons",
        sa.Column(
            "status",
            lesson_status_enum,
            nullable=False,
            server_default="draft",
        ),
    )
    op.create_index(op.f("ix_lessons_status"), "lessons", ["status"], unique=False)

    # Keep existing lessons visible to students after introducing moderation flow.
    conn.execute(sa.text("UPDATE lessons SET status = 'published'"))


def downgrade() -> None:
    op.drop_index(op.f("ix_lessons_status"), table_name="lessons")
    op.drop_column("lessons", "status")
    op.execute("DROP TYPE IF EXISTS lesson_status")
