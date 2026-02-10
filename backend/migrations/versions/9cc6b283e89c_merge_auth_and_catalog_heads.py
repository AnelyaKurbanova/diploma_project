"""merge auth and catalog heads

Revision ID: 9cc6b283e89c
Revises: f532e9443a8a, ac7769b176f5
Create Date: 2026-02-10 14:14:47.123886

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9cc6b283e89c'
down_revision = ('f532e9443a8a', 'ac7769b176f5')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
