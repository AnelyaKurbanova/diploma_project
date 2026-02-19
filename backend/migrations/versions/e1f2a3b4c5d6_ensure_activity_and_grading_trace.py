"""ensure activity table and submissions.grading_trace exist

Revision ID: e1f2a3b4c5d6
Revises: d9e8f7a6b5c4
Create Date: 2026-02-19 12:20:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "e1f2a3b4c5d6"
down_revision = "d9e8f7a6b5c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            ALTER TABLE submissions
            ADD COLUMN IF NOT EXISTS grading_trace JSONB;
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS user_activity_events (
              id UUID PRIMARY KEY,
              user_id UUID REFERENCES users(id) ON DELETE SET NULL,
              event_type VARCHAR(80) NOT NULL,
              path VARCHAR(512),
              ip VARCHAR(64),
              user_agent VARCHAR(512),
              meta JSONB,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS ix_user_activity_events_user_id
            ON user_activity_events (user_id);
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS ix_user_activity_events_event_type
            ON user_activity_events (event_type);
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS ix_user_activity_events_created_at
            ON user_activity_events (created_at);
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS user_activity_events CASCADE;"))
    op.execute(sa.text("ALTER TABLE submissions DROP COLUMN IF EXISTS grading_trace;"))
