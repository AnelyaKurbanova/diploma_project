"""add pending_review problem status

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-02-11 16:00:00.000000

"""
from __future__ import annotations

from alembic import op


revision = "f3a4b5c6d7e8"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("COMMIT")
    op.execute("ALTER TYPE problem_status ADD VALUE IF NOT EXISTS 'PENDING_REVIEW'")
    # Note: PostgreSQL may lowercase the value depending on quoting.
    # Ensure it is stored as uppercase to match DRAFT, PUBLISHED, ARCHIVED.
    # If it was stored lowercase, rename it:
    op.execute(
        "DO $$ BEGIN "
        "  IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending_review' "
        "    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'problem_status')) THEN "
        "    ALTER TYPE problem_status RENAME VALUE 'pending_review' TO 'PENDING_REVIEW'; "
        "  END IF; "
        "END $$"
    )


def downgrade() -> None:
    pass
