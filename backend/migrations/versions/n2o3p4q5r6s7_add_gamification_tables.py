"""add gamification tables

Revision ID: n2o3p4q5r6s7
Revises: m1n2o3p4q5r6, z1y2x3w4v5u6
Create Date: 2026-03-18 12:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


revision = "n2o3p4q5r6s7"
down_revision = ("m1n2o3p4q5r6", "z1y2x3w4v5u6")
branch_labels = None
depends_on = None


ACHIEVEMENTS = [
    {
        "id": "0e2e7330-2156-4ec8-8ec8-1d10dc0e1001",
        "code": "first_solution",
        "title": "Первое решение",
        "description": "Решите первую задачу правильно.",
        "icon_name": "sparkles",
        "icon_url": None,
        "xp_reward": 10,
        "is_active": True,
        "trigger_type": "problems_solved",
    },
    {
        "id": "0e2e7330-2156-4ec8-8ec8-1d10dc0e1002",
        "code": "problems_10",
        "title": "Разогрев",
        "description": "Решите 10 задач правильно.",
        "icon_name": "bolt",
        "icon_url": None,
        "xp_reward": 25,
        "is_active": True,
        "trigger_type": "problems_solved",
    },
    {
        "id": "0e2e7330-2156-4ec8-8ec8-1d10dc0e1003",
        "code": "first_lesson",
        "title": "Первый урок",
        "description": "Завершите первый урок.",
        "icon_name": "book-open",
        "icon_url": None,
        "xp_reward": 5,
        "is_active": True,
        "trigger_type": "lessons_completed",
    },
    {
        "id": "0e2e7330-2156-4ec8-8ec8-1d10dc0e1004",
        "code": "lessons_10",
        "title": "Стабильный темп",
        "description": "Завершите 10 уроков.",
        "icon_name": "academic-cap",
        "icon_url": None,
        "xp_reward": 25,
        "is_active": True,
        "trigger_type": "lessons_completed",
    },
    {
        "id": "0e2e7330-2156-4ec8-8ec8-1d10dc0e1005",
        "code": "streak_3",
        "title": "Три дня подряд",
        "description": "Сохраняйте активность 3 дня подряд.",
        "icon_name": "fire",
        "icon_url": None,
        "xp_reward": 20,
        "is_active": True,
        "trigger_type": "streak_days",
    },
    {
        "id": "0e2e7330-2156-4ec8-8ec8-1d10dc0e1006",
        "code": "streak_7",
        "title": "Неделя фокуса",
        "description": "Сохраняйте активность 7 дней подряд.",
        "icon_name": "flame",
        "icon_url": None,
        "xp_reward": 50,
        "is_active": True,
        "trigger_type": "streak_days",
    },
    {
        "id": "0e2e7330-2156-4ec8-8ec8-1d10dc0e1007",
        "code": "xp_100",
        "title": "100 XP",
        "description": "Наберите 100 XP.",
        "icon_name": "trophy",
        "icon_url": None,
        "xp_reward": 0,
        "is_active": True,
        "trigger_type": "xp_total",
    },
    {
        "id": "0e2e7330-2156-4ec8-8ec8-1d10dc0e1008",
        "code": "xp_500",
        "title": "500 XP",
        "description": "Наберите 500 XP.",
        "icon_name": "star",
        "icon_url": None,
        "xp_reward": 0,
        "is_active": True,
        "trigger_type": "xp_total",
    },
]


def upgrade() -> None:
    op.create_table(
        "achievements",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon_name", sa.String(length=128), nullable=True),
        sa.Column("icon_url", sa.String(length=2048), nullable=True),
        sa.Column("xp_reward", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("trigger_type", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_achievements_code"),
    )
    op.create_index("ix_achievements_is_active", "achievements", ["is_active"], unique=False)
    op.create_index("ix_achievements_trigger_type", "achievements", ["trigger_type"], unique=False)

    op.create_table(
        "user_achievements",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("achievement_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["achievement_id"], ["achievements.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "achievement_id", name="uq_user_achievements_user_achievement"),
    )
    op.create_index("ix_user_achievements_user_id", "user_achievements", ["user_id"], unique=False)
    op.create_index("ix_user_achievements_achievement_id", "user_achievements", ["achievement_id"], unique=False)
    op.create_index("ix_user_achievements_unlocked_at", "user_achievements", ["unlocked_at"], unique=False)

    op.create_table(
        "user_streaks",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_activity_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_streaks_user_id"),
    )
    op.create_index("ix_user_streaks_longest_streak", "user_streaks", ["longest_streak"], unique=False)
    op.create_index("ix_user_streaks_last_activity_date", "user_streaks", ["last_activity_date"], unique=False)

    op.create_table(
        "user_xp",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("total_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_xp_user_id"),
    )
    op.create_index("ix_user_xp_total_xp", "user_xp", ["total_xp"], unique=False)

    achievements_table = sa.table(
        "achievements",
        sa.column("id", pg.UUID(as_uuid=True)),
        sa.column("code", sa.String(length=100)),
        sa.column("title", sa.String(length=255)),
        sa.column("description", sa.Text()),
        sa.column("icon_name", sa.String(length=128)),
        sa.column("icon_url", sa.String(length=2048)),
        sa.column("xp_reward", sa.Integer()),
        sa.column("is_active", sa.Boolean()),
        sa.column("trigger_type", sa.String(length=64)),
    )
    op.bulk_insert(achievements_table, ACHIEVEMENTS)


def downgrade() -> None:
    op.drop_index("ix_user_xp_total_xp", table_name="user_xp")
    op.drop_table("user_xp")

    op.drop_index("ix_user_streaks_last_activity_date", table_name="user_streaks")
    op.drop_index("ix_user_streaks_longest_streak", table_name="user_streaks")
    op.drop_table("user_streaks")

    op.drop_index("ix_user_achievements_unlocked_at", table_name="user_achievements")
    op.drop_index("ix_user_achievements_achievement_id", table_name="user_achievements")
    op.drop_index("ix_user_achievements_user_id", table_name="user_achievements")
    op.drop_table("user_achievements")

    op.drop_index("ix_achievements_trigger_type", table_name="achievements")
    op.drop_index("ix_achievements_is_active", table_name="achievements")
    op.drop_table("achievements")
