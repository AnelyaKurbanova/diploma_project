"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-02-17

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── enums ──────────────────────────────────────────────────────────
    problem_type = sa.Enum(
        "SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMERIC", "SHORT_TEXT", "MATCH",
        name="problem_type",
    )
    problem_difficulty = sa.Enum("EASY", "MEDIUM", "HARD", name="problem_difficulty")
    problem_status = sa.Enum(
        "DRAFT", "PENDING_REVIEW", "PUBLISHED", "ARCHIVED",
        name="problem_status",
    )
    user_role = sa.Enum(
        "student", "teacher", "content_maker", "moderator", "admin",
        name="user_role",
    )
    block_type = pg.ENUM("lecture", "video", "problem_set", name="block_type", create_type=False)
    op.execute("CREATE TYPE block_type AS ENUM ('lecture','video','problem_set')")

    # ── standalone / root tables ───────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String(2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_projects_name"), "projects", ["name"], unique=True)

    op.create_table(
        "security_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_security_events_event_type"), "security_events", ["event_type"])
    op.create_index(op.f("ix_security_events_user_id"), "security_events", ["user_id"])

    op.create_table(
        "problem_tags",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # ── users ──────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("is_email_verified", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("role", user_role, server_default="student", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # ── auth ───────────────────────────────────────────────────────────
    op.create_table(
        "auth_accounts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("provider_user_id", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_user_id", name="uq_auth_provider_user"),
        sa.UniqueConstraint("user_id", "provider", name="uq_auth_user_provider"),
    )
    op.create_index(op.f("ix_auth_accounts_user_id"), "auth_accounts", ["user_id"])

    op.create_table(
        "email_verifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("purpose", sa.String(20), nullable=False),
        sa.Column("code_hash", sa.String(255), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resend_not_before", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_email_verifications_user_id"), "email_verifications", ["user_id"])

    op.create_table(
        "refresh_sessions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("refresh_hash", sa.Text(), nullable=False),
        sa.Column("csrf_hash", sa.Text(), nullable=False),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rotated_from", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_refresh_sessions_user_id"), "refresh_sessions", ["user_id"])

    # ── schools ────────────────────────────────────────────────────────
    op.create_table(
        "schools",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("teacher_code_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── catalog ────────────────────────────────────────────────────────
    op.create_table(
        "subjects",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name_ru", sa.String(255), nullable=False),
        sa.Column("name_kk", sa.String(255), nullable=True),
        sa.Column("name_en", sa.String(255), nullable=True),
        sa.Column("description_ru", sa.Text(), nullable=True),
        sa.Column("description_kk", sa.Text(), nullable=True),
        sa.Column("description_en", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_subjects_code"), "subjects", ["code"], unique=True)

    op.create_table(
        "topics",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("subject_id", sa.UUID(), nullable=False),
        sa.Column("parent_topic_id", sa.UUID(), nullable=True),
        sa.Column("title_ru", sa.String(255), nullable=False),
        sa.Column("title_kk", sa.String(255), nullable=True),
        sa.Column("title_en", sa.String(255), nullable=True),
        sa.Column("grade_level", sa.Integer(), nullable=True),
        sa.Column("order_no", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["parent_topic_id"], ["topics.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_topics_grade_level"), "topics", ["grade_level"])
    op.create_index(op.f("ix_topics_parent_topic_id"), "topics", ["parent_topic_id"])
    op.create_index(op.f("ix_topics_subject_id"), "topics", ["subject_id"])

    # ── user_profiles (depends on users, schools) ──────────────────────
    op.create_table(
        "user_profiles",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("school_id", sa.UUID(), nullable=True),
        sa.Column("school", sa.String(255), nullable=True),
        sa.Column("city", sa.String(255), nullable=True),
        sa.Column("grade_level", sa.Integer(), nullable=True),
        sa.Column("preferred_language", sa.String(16), server_default="ru", nullable=False),
        sa.Column("timezone", sa.String(64), server_default="Asia/Almaty", nullable=False),
        sa.Column("primary_goal", sa.String(64), nullable=True),
        sa.Column("interested_subjects", pg.JSONB, nullable=True),
        sa.Column("intro_difficulties", sa.Text(), nullable=True),
        sa.Column("intro_notes", sa.Text(), nullable=True),
        sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="SET NULL", name="fk_user_profiles_school_id_schools"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    # ── problems ───────────────────────────────────────────────────────
    op.create_table(
        "problems",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("subject_id", sa.UUID(), nullable=False),
        sa.Column("topic_id", sa.UUID(), nullable=True),
        sa.Column("type", problem_type, nullable=False),
        sa.Column("difficulty", problem_difficulty, nullable=False),
        sa.Column("status", problem_status, nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("time_limit_sec", sa.Integer(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True, comment="Author user id"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_problems_created_by"), "problems", ["created_by"])
    op.create_index(op.f("ix_problems_status"), "problems", ["status"])
    op.create_index(op.f("ix_problems_subject_id"), "problems", ["subject_id"])
    op.create_index(op.f("ix_problems_topic_id"), "problems", ["topic_id"])

    op.create_table(
        "problem_answer_keys",
        sa.Column("problem_id", sa.UUID(), nullable=False),
        sa.Column("numeric_answer", sa.Numeric(), nullable=True),
        sa.Column("text_answer", sa.String(255), nullable=True),
        sa.Column("answer_pattern", sa.String(255), nullable=True),
        sa.Column("tolerance", sa.Numeric(), nullable=True),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("problem_id"),
    )

    op.create_table(
        "problem_choices",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("problem_id", sa.UUID(), nullable=False),
        sa.Column("choice_text", sa.Text(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("order_no", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_problem_choices_problem_id"), "problem_choices", ["problem_id"])

    op.create_table(
        "problem_tag_map",
        sa.Column("problem_id", sa.UUID(), nullable=False),
        sa.Column("tag_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["problem_tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("problem_id", "tag_id"),
        sa.UniqueConstraint("problem_id", "tag_id", name="uq_problem_tag"),
    )

    # ── lessons ────────────────────────────────────────────────────────
    op.create_table(
        "lessons",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("topic_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("order_no", sa.Integer(), nullable=False),
        sa.Column("theory_body", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lessons_topic_id"), "lessons", ["topic_id"])

    op.create_table(
        "lesson_problem_map",
        sa.Column("lesson_id", sa.UUID(), nullable=False),
        sa.Column("problem_id", sa.UUID(), nullable=False),
        sa.Column("order_no", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("lesson_id", "problem_id"),
        sa.UniqueConstraint("lesson_id", "problem_id", name="uq_lesson_problem"),
    )

    op.create_table(
        "lesson_content_blocks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("lesson_id", sa.UUID(), nullable=False),
        sa.Column("block_type", block_type, nullable=False),
        sa.Column("order_no", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("video_url", sa.String(2048), nullable=True),
        sa.Column("video_description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lesson_content_blocks_lesson_id", "lesson_content_blocks", ["lesson_id"])

    op.create_table(
        "block_problem_map",
        sa.Column("content_block_id", sa.UUID(), nullable=False),
        sa.Column("problem_id", sa.UUID(), nullable=False),
        sa.Column("order_no", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["content_block_id"], ["lesson_content_blocks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("content_block_id", "problem_id"),
        sa.UniqueConstraint("content_block_id", "problem_id", name="uq_block_problem"),
    )

    op.create_table(
        "lesson_progress",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("lesson_id", sa.UUID(), nullable=False),
        sa.Column("completed", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("time_spent_sec", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "lesson_id"),
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_user_lesson_progress"),
    )
    op.create_index("ix_lesson_progress_user_id", "lesson_progress", ["user_id"])

    # ── submissions ────────────────────────────────────────────────────
    op.create_table(
        "submissions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("problem_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("attempt_no", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("answer_numeric", sa.Numeric(), nullable=True),
        sa.Column("grading_trace", pg.JSONB, nullable=True),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_submissions_problem_id"), "submissions", ["problem_id"])
    op.create_index(op.f("ix_submissions_user_id"), "submissions", ["user_id"])

    op.create_table(
        "submission_choice_map",
        sa.Column("submission_id", sa.UUID(), nullable=False),
        sa.Column("choice_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["choice_id"], ["problem_choices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("submission_id", "choice_id"),
        sa.UniqueConstraint("submission_id", "choice_id", name="uq_submission_choice"),
    )

    # ── classes ────────────────────────────────────────────────────────
    op.create_table(
        "classes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("teacher_id", sa.UUID(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("join_code", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE", name="fk_classes_teacher_id_users"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="SET NULL", name="fk_classes_school_id_schools"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_classes_teacher_id", "classes", ["teacher_id"])
    op.create_index("ix_classes_school_id", "classes", ["school_id"])
    op.create_index("ix_classes_join_code", "classes", ["join_code"], unique=True)

    op.create_table(
        "class_students",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("class_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE", name="fk_class_students_class_id_classes"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE", name="fk_class_students_student_id_users"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("class_id", "student_id", name="uq_class_student"),
    )
    op.create_index("ix_class_students_class_id", "class_students", ["class_id"])
    op.create_index("ix_class_students_student_id", "class_students", ["student_id"])

    # ── user activity events ───────────────────────────────────────────
    op.create_table(
        "user_activity_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("path", sa.String(512), nullable=True),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("meta", pg.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_activity_events_user_id", "user_activity_events", ["user_id"])
    op.create_index("ix_user_activity_events_event_type", "user_activity_events", ["event_type"])
    op.create_index("ix_user_activity_events_created_at", "user_activity_events", ["created_at"])


def downgrade() -> None:
    op.drop_table("user_activity_events")
    op.drop_table("class_students")
    op.drop_table("classes")
    op.drop_table("submission_choice_map")
    op.drop_table("submissions")
    op.drop_table("lesson_progress")
    op.drop_table("block_problem_map")
    op.drop_table("lesson_content_blocks")
    op.drop_table("lesson_problem_map")
    op.drop_table("lessons")
    op.drop_table("problem_tag_map")
    op.drop_table("problem_choices")
    op.drop_table("problem_answer_keys")
    op.drop_table("problems")
    op.drop_table("user_profiles")
    op.drop_table("topics")
    op.drop_table("subjects")
    op.drop_table("schools")
    op.drop_table("refresh_sessions")
    op.drop_table("email_verifications")
    op.drop_table("auth_accounts")
    op.drop_table("users")
    op.drop_table("problem_tags")
    op.drop_table("security_events")
    op.drop_table("projects")
    op.execute("DROP TYPE IF EXISTS block_type")
    op.execute("DROP TYPE IF EXISTS user_role")
    op.execute("DROP TYPE IF EXISTS problem_status")
    op.execute("DROP TYPE IF EXISTS problem_difficulty")
    op.execute("DROP TYPE IF EXISTS problem_type")

