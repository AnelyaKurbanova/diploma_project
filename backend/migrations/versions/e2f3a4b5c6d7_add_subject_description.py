"""add subject description fields

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-02-11 15:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "e2f3a4b5c6d7"
down_revision = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("subjects", sa.Column("description_ru", sa.Text(), nullable=True))
    op.add_column("subjects", sa.Column("description_kk", sa.Text(), nullable=True))
    op.add_column("subjects", sa.Column("description_en", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("subjects", "description_en")
    op.drop_column("subjects", "description_kk")
    op.drop_column("subjects", "description_ru")
