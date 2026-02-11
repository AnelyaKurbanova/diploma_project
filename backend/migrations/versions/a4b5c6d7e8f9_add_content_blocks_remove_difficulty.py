"""add lesson_content_blocks, block_problem_map and remove topics.difficulty_level

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-02-11 18:00:00.000000

"""
from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


revision = "a4b5c6d7e8f9"
down_revision = "f3a4b5c6d7e8"
branch_labels = None
depends_on = None

    
def upgrade() -> None:
    # --- Ensure block_type enum exists (idempotent) ---
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'block_type'
              ) THEN
                CREATE TYPE block_type AS ENUM ('lecture', 'video', 'problem_set');
              END IF;
            END
            $$;
            """
        )
    )

    # Use PostgreSQL ENUM type explicitly with create_type=False,
    # so SQLAlchemy will not attempt to create the type again.
    block_type_enum = pg.ENUM(
        "lecture",
        "video",
        "problem_set",
        name="block_type",
        create_type=False,
    )

    # --- Create lesson_content_blocks table ---
    op.create_table(
        "lesson_content_blocks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("lesson_id", sa.UUID(), nullable=False),
        sa.Column("block_type", block_type_enum, nullable=False),
        sa.Column("order_no", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("video_url", sa.String(2048), nullable=True),
        sa.Column("video_description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_lesson_content_blocks_lesson_id",
        "lesson_content_blocks",
        ["lesson_id"],
    )

    # --- Create block_problem_map table ---
    op.create_table(
        "block_problem_map",
        sa.Column("content_block_id", sa.UUID(), nullable=False),
        sa.Column("problem_id", sa.UUID(), nullable=False),
        sa.Column("order_no", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(
            ["content_block_id"],
            ["lesson_content_blocks.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["problem_id"],
            ["problems.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("content_block_id", "problem_id"),
        sa.UniqueConstraint("content_block_id", "problem_id", name="uq_block_problem"),
    )

    # --- Remove difficulty_level from topics ---
    op.drop_column("topics", "difficulty_level")

    # ------------------------------------------------------------------
    # Data migration: move existing lesson data into content blocks
    # ------------------------------------------------------------------

    # 1) For each lesson with theory_body, create a lecture content block
    lessons_with_body = conn.execute(
        sa.text(
            "SELECT id, theory_body FROM lessons WHERE theory_body IS NOT NULL AND theory_body != ''"
        )
    ).fetchall()

    for lesson_id, theory_body in lessons_with_body:
        block_id = uuid.uuid4()
        conn.execute(
            sa.text(
                "INSERT INTO lesson_content_blocks "
                "(id, lesson_id, block_type, order_no, title, body, created_at, updated_at) "
                "VALUES (:id, :lesson_id, 'lecture', 0, 'Лекция', :body, NOW(), NOW())"
            ),
            {"id": str(block_id), "lesson_id": str(lesson_id), "body": theory_body},
        )

    # 2) For each lesson that has entries in lesson_problem_map,
    #    create a problem_set block and copy the mappings
    lessons_with_problems = conn.execute(
        sa.text(
            "SELECT DISTINCT lesson_id FROM lesson_problem_map"
        )
    ).fetchall()

    for (lesson_id,) in lessons_with_problems:
        block_id = uuid.uuid4()

        # Check if the lesson already has a lecture block (to set correct order_no)
        has_lecture = conn.execute(
            sa.text(
                "SELECT 1 FROM lesson_content_blocks "
                "WHERE lesson_id = :lid AND block_type = 'lecture' LIMIT 1"
            ),
            {"lid": str(lesson_id)},
        ).fetchone()
        order_no = 1 if has_lecture else 0

        conn.execute(
            sa.text(
                "INSERT INTO lesson_content_blocks "
                "(id, lesson_id, block_type, order_no, title, created_at, updated_at) "
                "VALUES (:id, :lesson_id, 'problem_set', :order_no, 'Задачи', NOW(), NOW())"
            ),
            {"id": str(block_id), "lesson_id": str(lesson_id), "order_no": order_no},
        )

        # Copy problem mappings
        problem_rows = conn.execute(
            sa.text(
                "SELECT problem_id, order_no FROM lesson_problem_map "
                "WHERE lesson_id = :lid ORDER BY order_no"
            ),
            {"lid": str(lesson_id)},
        ).fetchall()

        for problem_id, prob_order in problem_rows:
            conn.execute(
                sa.text(
                    "INSERT INTO block_problem_map "
                    "(content_block_id, problem_id, order_no) "
                    "VALUES (:block_id, :problem_id, :order_no)"
                ),
                {
                    "block_id": str(block_id),
                    "problem_id": str(problem_id),
                    "order_no": prob_order,
                },
            )


def downgrade() -> None:
    # --- Re-add difficulty_level to topics ---
    op.add_column(
        "topics",
        sa.Column("difficulty_level", sa.Integer(), nullable=False, server_default="1"),
    )

    # --- Drop block_problem_map ---
    op.drop_table("block_problem_map")

    # --- Drop lesson_content_blocks ---
    op.drop_index("ix_lesson_content_blocks_lesson_id", table_name="lesson_content_blocks")
    op.drop_table("lesson_content_blocks")

    # --- Drop block_type enum ---
    op.execute("DROP TYPE IF EXISTS block_type")
