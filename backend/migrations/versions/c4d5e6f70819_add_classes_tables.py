"""compat stub for missing revision c4d5e6f70819

Revision ID: c4d5e6f70819
Revises: 0002
Create Date: 2026-02-17 16:18:00.000000

"""
from __future__ import annotations


revision = "c4d5e6f70819"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Compatibility revision restored to keep the Alembic graph consistent.
    # Original schema changes are already represented by other migrations.
    pass


def downgrade() -> None:
    pass
