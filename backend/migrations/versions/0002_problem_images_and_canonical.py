"""Add problem_images table and canonical_answer column.

Revision ID: 0002
Revises:
Create Date: 2026-02-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "problem_answer_keys",
        sa.Column("canonical_answer", sa.String(512), nullable=True),
    )

    op.create_table(
        "problem_images",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("problem_id", UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("url", sa.String(1024), nullable=False),
        sa.Column("order_no", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("alt_text", sa.String(255), nullable=True),
        sa.UniqueConstraint("problem_id", "order_no", name="uq_problem_image_order"),
    )


def downgrade() -> None:
    op.drop_table("problem_images")
    op.drop_column("problem_answer_keys", "canonical_answer")
