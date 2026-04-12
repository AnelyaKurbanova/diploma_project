"""Add statement_normalized column and unique constraint for problems.

Revision ID: z1y2x3w4v5u6
Revises: 014109580078
Create Date: 2026-03-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "z1y2x3w4v5u6"
down_revision = "014109580078"
branch_labels = None
depends_on = None


def upgrade() -> None:
                                                                    
    op.add_column(
        "problems",
        sa.Column("statement_normalized", sa.Text(), nullable=True),
    )

                                                                              
                             
                                              
                                                            
    op.execute(
        sa.text(
            """
            UPDATE problems
            SET statement_normalized = regexp_replace(
                regexp_replace(
                  regexp_replace(btrim(statement), E'\\r\\n', E'\\n', 'g'),
                  E'\\r', E'\\n', 'g'
                ),
                E'[ \\t]+',
                ' ',
                'g'
            )
            WHERE statement IS NOT NULL;
            """
        )
    )

                                      
    op.alter_column(
        "problems",
        "statement_normalized",
        nullable=False,
        existing_type=sa.Text(),
    )

                                                                        
    op.create_unique_constraint(
        "uq_problem_topic_statement_norm",
        "problems",
        ["topic_id", "statement_normalized"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_problem_topic_statement_norm",
        "problems",
        type_="unique",
    )
    op.drop_column("problems", "statement_normalized")

