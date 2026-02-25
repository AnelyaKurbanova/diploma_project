"""add pgvector and knowledge tables

Revision ID: g2h3i4j5k6l7
Revises: f1a2b3c4d5e6
Create Date: 2026-02-25

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "g2h3i4j5k6l7"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "rag_documents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("subject_code", sa.String(64), nullable=False, index=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "rag_chunks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("section", sa.String(255), nullable=True),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["rag_documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute("ALTER TABLE rag_chunks ADD COLUMN embedding vector(384) NOT NULL")
    op.create_index("ix_rag_chunks_document_id", "rag_chunks", ["document_id"], unique=False)

    op.execute(
        """
        CREATE INDEX ix_rag_chunks_embedding
        ON rag_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_rag_chunks_embedding")
    op.drop_index("ix_rag_chunks_document_id", table_name="rag_chunks")
    op.drop_table("rag_chunks")
    op.drop_table("rag_documents")
    op.execute("DROP EXTENSION IF EXISTS vector")
