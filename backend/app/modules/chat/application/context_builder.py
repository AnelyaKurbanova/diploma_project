from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.lessons.data.repo import LessonsRepo
from app.modules.problems.data.models import ProblemModel
from app.modules.submissions.data.models import SubmissionModel


async def build_lesson_context(session: AsyncSession, lesson_id: uuid.UUID) -> str:
    repo = LessonsRepo(session)
    lesson = await repo.get_lesson_with_blocks(lesson_id)

    parts: list[str] = []
    parts.append(f"Lesson: {lesson.title}")

    if lesson.theory_body:
        parts.append(f"\n## Theory\n{lesson.theory_body}")

    for block in lesson.content_blocks:
        if block.block_type.value == "lecture" and block.body:
            heading = block.title or "Lecture"
            parts.append(f"\n## {heading}\n{block.body}")
        elif block.block_type.value == "video" and block.video_description:
            heading = block.title or "Video"
            parts.append(f"\n## {heading}\n{block.video_description}")
        elif block.block_type.value == "problem_set" and block.problem_links:
            for link in block.problem_links:
                problem = await session.get(ProblemModel, link.problem_id)
                if problem:
                    parts.append(f"\n### Problem: {problem.title}\n{problem.statement}")

    return "\n".join(parts)


async def build_problem_context(
    session: AsyncSession,
    problem_id: uuid.UUID,
    user_id: uuid.UUID,
) -> str:
    stmt = (
        select(ProblemModel)
        .where(ProblemModel.id == problem_id)
        .options(selectinload(ProblemModel.choices))
    )
    problem = (await session.execute(stmt)).scalar_one_or_none()
    if not problem:
        return "Problem not found."

    parts: list[str] = []
    parts.append(f"Problem: {problem.title}")
    parts.append(f"Difficulty: {problem.difficulty.value}")
    parts.append(f"Type: {problem.type.value}")
    parts.append(f"\nStatement:\n{problem.statement}")

    if problem.choices:
        parts.append("\nChoices:")
        for choice in sorted(problem.choices, key=lambda c: c.order_no):
            parts.append(f"- {choice.choice_text}")

    stmt = (
        select(SubmissionModel)
        .where(
            SubmissionModel.user_id == user_id,
            SubmissionModel.problem_id == problem_id,
            SubmissionModel.is_correct == False,
        )
        .order_by(SubmissionModel.submitted_at.asc())
    )
    wrong_subs = (await session.execute(stmt)).scalars().all()
    if wrong_subs:
        parts.append("\nStudent's previous wrong answers:")
        for sub in wrong_subs:
            if sub.answer_text:
                parts.append(f"- {sub.answer_text}")

    return "\n".join(parts)
