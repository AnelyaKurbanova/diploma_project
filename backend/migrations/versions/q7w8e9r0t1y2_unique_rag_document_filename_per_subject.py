"""unique rag document filename per subject

Revision ID: q7w8e9r0t1y2
Revises: m1n2o3p4q5r6
Create Date: 2026-04-02

"""

from __future__ import annotations

from alembic import op

revision = "q7w8e9r0t1y2"
down_revision = "m1n2o3p4q5r6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_rag_documents_subject_code_filename",
        "rag_documents",
        ["subject_code", "filename"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_rag_documents_subject_code_filename", table_name="rag_documents")

