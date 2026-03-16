"""merge heads before chat

Revision ID: 232698c419db
Revises: b1d2e3f4a5b6, k1l2m3n4o5p6
Create Date: 2026-03-16 23:48:31.481398

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '232698c419db'
down_revision = ('b1d2e3f4a5b6', 'k1l2m3n4o5p6')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
