"""add classes and class_students tables

Revision ID: c4d5e6f70819
Revises: f3a4b5c6d7e8
Create Date: 2026-02-11

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "c4d5e6f70819"
down_revision = "a4b5c6d7e8f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "classes",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("teacher_id", UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("join_code", sa.String(length=32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_classes_teacher_id",
        "classes",
        ["teacher_id"],
        unique=False,
    )
    op.create_index(
        "ix_classes_school_id",
        "classes",
        ["school_id"],
        unique=False,
    )
    op.create_index(
        "ix_classes_join_code",
        "classes",
        ["join_code"],
        unique=True,
    )
    op.create_foreign_key(
        "fk_classes_teacher_id_users",
        "classes",
        "users",
        ["teacher_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_classes_school_id_schools",
        "classes",
        "schools",
        ["school_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "class_students",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("class_id", UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("class_id", "student_id", name="uq_class_student"),
    )
    op.create_index(
        "ix_class_students_class_id",
        "class_students",
        ["class_id"],
        unique=False,
    )
    op.create_index(
        "ix_class_students_student_id",
        "class_students",
        ["student_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_class_students_class_id_classes",
        "class_students",
        "classes",
        ["class_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_class_students_student_id_users",
        "class_students",
        "users",
        ["student_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_class_students_student_id_users",
        "class_students",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_class_students_class_id_classes",
        "class_students",
        type_="foreignkey",
    )
    op.drop_index("ix_class_students_student_id", table_name="class_students")
    op.drop_index("ix_class_students_class_id", table_name="class_students")
    op.drop_table("class_students")

    op.drop_constraint(
        "fk_classes_school_id_schools",
        "classes",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_classes_teacher_id_users",
        "classes",
        type_="foreignkey",
    )
    op.drop_index("ix_classes_join_code", table_name="classes")
    op.drop_index("ix_classes_school_id", table_name="classes")
    op.drop_index("ix_classes_teacher_id", table_name="classes")
    op.drop_table("classes")

