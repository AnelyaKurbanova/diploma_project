from __future__ import annotations

import uuid

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound
from app.core.i18n import tr
from app.modules.catalog.data.repo import CatalogRepo
from app.modules.knowledge.application.retrieval import search as knowledge_search
from app.modules.problems.api.schemas import ProblemCreate, ProblemUpdate
from app.modules.problems.application.canonicalize import normalize_for_storage
from app.modules.problems.application.dedup import normalize_statement_for_dedup
from app.modules.problems.application.llm_rag_problems import (
    GeneratedProblem,
    generate_problems_from_context,
)
from app.modules.problems.data.models import (
    ProblemDifficulty,
    ProblemModel,
    ProblemStatus,
)
from app.modules.problems.data.repo import ProblemsRepo
from app.modules.submissions.data.models import SubmissionModel


def _compute_canonical(answer_key_data) -> str | None:  # noqa: ANN001
    if answer_key_data is None:
        return None
    raw = answer_key_data.text_answer
    if raw:
        return normalize_for_storage(raw)
    if answer_key_data.numeric_answer is not None:
        return normalize_for_storage(str(answer_key_data.numeric_answer))
    return None


class ProblemService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ProblemsRepo(session)
        self.catalog_repo = CatalogRepo(session)

    async def _commit_and_reload(self, problem_id: uuid.UUID) -> ProblemModel:
        await self.session.commit()
        return await self.repo.get_problem(problem_id)

    async def _save_answer_keys(self, problem: ProblemModel, answer_key_data) -> None:  # noqa: ANN001
        if answer_key_data is None:
            return
        canonical = _compute_canonical(answer_key_data)
        await self.repo.set_answer_keys(
            problem,
            numeric_answer=(
                float(answer_key_data.numeric_answer)
                if answer_key_data.numeric_answer is not None
                else None
            ),
            text_answer=answer_key_data.text_answer,
            answer_pattern=answer_key_data.answer_pattern,
            tolerance=(
                float(answer_key_data.tolerance)
                if answer_key_data.tolerance is not None
                else None
            ),
            canonical_answer=canonical,
        )

    async def _save_images(self, problem: ProblemModel, images_data) -> None:  # noqa: ANN001
        if images_data is None:
            return
        await self.repo.set_images(
            problem,
            [(img.url, img.order_no, img.alt_text) for img in images_data],
        )

    async def create_draft_problem(
        self,
        data: ProblemCreate,
        *,
        created_by: uuid.UUID | None = None,
    ) -> ProblemModel:
        statement_normalized = normalize_statement_for_dedup(data.statement or "")
        problem = await self.repo.create_problem(
            subject_id=data.subject_id,
            topic_id=data.topic_id,
            type=data.type,
            difficulty=data.difficulty,
            title=data.title,
            statement=data.statement,
            statement_normalized=statement_normalized,
            explanation=data.explanation,
            time_limit_sec=data.time_limit_sec,
            points=data.points,
            created_by=created_by,
        )

        if data.choices is not None:
            await self.repo.set_choices(
                problem,
                [
                    (c.choice_text, c.is_correct, c.order_no)
                    for c in data.choices
                ],
            )

        await self._save_answer_keys(problem, data.answer_key)

        if data.tags is not None:
            await self.repo.set_tags(
                problem,
                [t.name for t in data.tags],
            )

        await self._save_images(problem, data.images)

        return await self._commit_and_reload(problem.id)

    async def get(self, problem_id: uuid.UUID) -> ProblemModel:
        return await self.repo.get_problem(problem_id)

    async def get_public(self, problem_id: uuid.UUID) -> ProblemModel:
        problem = await self.repo.get_problem(problem_id)
        if problem.status != ProblemStatus.PUBLISHED:
            from app.core.errors import NotFound

            raise NotFound(tr("problem_not_found"))
        return problem

    async def list_public(
        self,
        *,
        subject_id: uuid.UUID | None = None,
        topic_id: uuid.UUID | None = None,
        difficulty: ProblemDifficulty | None = None,
    ) -> list[ProblemModel]:
        return await self.repo.list_problems(
            subject_id=subject_id,
            topic_id=topic_id,
            difficulty=difficulty,
            status=ProblemStatus.PUBLISHED,
        )

    async def update_draft(
        self,
        problem_id: uuid.UUID,
        data: ProblemUpdate,
        *,
        allow_published_edit: bool = False,
    ) -> ProblemModel:
        problem = await self.repo.get_problem(problem_id)
        if not allow_published_edit and problem.status not in (
            ProblemStatus.DRAFT,
            ProblemStatus.PENDING_REVIEW,
        ):
            from app.core.errors import Conflict

            raise Conflict(tr("only_draft_or_pending_edit"))

        if problem.status == ProblemStatus.PENDING_REVIEW and not allow_published_edit:
            await self.repo.change_status(problem_id, status=ProblemStatus.DRAFT)

        statement_normalized = (
            normalize_statement_for_dedup(data.statement or "")
            if data.statement is not None
            else None
        )

        problem = await self.repo.update_problem(
            problem_id,
            subject_id=data.subject_id,
            topic_id=data.topic_id,
            difficulty=data.difficulty,
            title=data.title,
            statement=data.statement,
            statement_normalized=statement_normalized,
            explanation=data.explanation,
            time_limit_sec=data.time_limit_sec,
            points=data.points,
        )

        if data.choices is not None:
            await self.repo.set_choices(
                problem,
                [
                    (c.choice_text, c.is_correct, c.order_no)
                    for c in data.choices
                ],
            )

        await self._save_answer_keys(problem, data.answer_key)

        if data.tags is not None:
            await self.repo.set_tags(
                problem,
                [t.name for t in data.tags],
            )

        await self._save_images(problem, data.images)

        return await self._commit_and_reload(problem_id)

    async def list_all(
        self,
        *,
        status: ProblemStatus | None = None,
        subject_id: uuid.UUID | None = None,
        topic_id: uuid.UUID | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[ProblemModel], int]:
        return await self.repo.list_problems_paginated(
            status=status,
            subject_id=subject_id,
            topic_id=topic_id,
            offset=offset,
            limit=limit,
        )

    async def submit_for_review(self, problem_id: uuid.UUID) -> ProblemModel:
        problem = await self.repo.get_problem(problem_id)
        if problem.status != ProblemStatus.DRAFT:
            from app.core.errors import Conflict
            raise Conflict(tr("only_draft_submit_review"))
        await self.repo.change_status(
            problem_id,
            status=ProblemStatus.PENDING_REVIEW,
        )
        return await self._commit_and_reload(problem_id)

    async def moderator_publish(self, problem_id: uuid.UUID) -> ProblemModel:
        problem = await self.repo.get_problem(problem_id)
        if problem.status != ProblemStatus.PENDING_REVIEW:
            from app.core.errors import Conflict
            raise Conflict(tr("only_pending_publish"))
        await self.repo.change_status(
            problem_id,
            status=ProblemStatus.PUBLISHED,
        )
        return await self._commit_and_reload(problem_id)

    async def reject_problem(self, problem_id: uuid.UUID) -> ProblemModel:
        problem = await self.repo.get_problem(problem_id)
        if problem.status != ProblemStatus.PENDING_REVIEW:
            from app.core.errors import Conflict
            raise Conflict(tr("only_pending_reject"))
        await self.repo.change_status(
            problem_id,
            status=ProblemStatus.DRAFT,
        )
        return await self._commit_and_reload(problem_id)

    async def archive_problem(self, problem_id: uuid.UUID) -> ProblemModel:
        await self.repo.change_status(
            problem_id,
            status=ProblemStatus.ARCHIVED,
        )
        return await self._commit_and_reload(problem_id)

    async def delete_problem(self, problem_id: uuid.UUID) -> None:
        # Сначала загружаем задачу, чтобы проверить её статус.
        problem = await self.repo.get_problem(problem_id)

        # Если задача в архиве, разрешаем жёстко удалить её вместе с отправленными решениями.
        if problem.status == ProblemStatus.ARCHIVED:
            # Удаляем все submissions по этой задаче, чтобы не мешал FK RESTRICT.
            await self.session.execute(
                delete(SubmissionModel).where(SubmissionModel.problem_id == problem_id)
            )

        await self.repo.delete_problem(problem_id)
        await self.session.commit()

    # ------------------------------------------------------------------
    # RAG-based generation
    # ------------------------------------------------------------------

    async def generate_from_rag(
        self,
        *,
        subject_id: uuid.UUID,
        topic_id: uuid.UUID,
        count: int = 10,
        created_by: uuid.UUID | None = None,
        difficulty_quota: dict[str, int] | None = None,
    ) -> tuple[list[ProblemModel], int]:
        """Generate draft problems from RAG context for the given subject+topic."""

        subject_row = await self.catalog_repo.get_subject(subject_id)
        topic_row = await self.catalog_repo.get_topic(topic_id)

        subject_uuid = subject_row.id
        topic_uuid = topic_row.id

        if topic_row.subject_id != subject_uuid:
            raise Conflict(tr("topic_not_found"))

        # Search relevant chunks in knowledge base.
        chunks = await knowledge_search(
            self.session,
            topic_row.title_ru,
            subject_code=subject_row.code,
            k=24,
        )
        if not chunks:
            raise NotFound(
                "Нет учебных материалов по предмету. Сначала загрузите docx через /knowledge/ingest."
            )

        chunk_texts = [c.content for c in chunks]

        generated: list[GeneratedProblem] = await generate_problems_from_context(
            topic_title=topic_row.title_ru,
            chunks=chunk_texts,
            count=count,
            difficulty_quota=difficulty_quota,
        )
        # Если модель не вернула ни одной корректной задачи, просто возвращаем
        # пустой список без ошибки — вызывающая сторона сама решит, как это
        # интерпретировать (например, как «0 создано»).
        if not generated:
            return [], 0

        created_problems: list[ProblemModel] = []
        skipped_duplicates = 0

        # Подготовка квот по сложностям, если они заданы.
        quota: dict[str, int] | None = None
        used: dict[str, int] = {}
        total_quota: int | None = None
        if difficulty_quota:
            # Оставляем только поддерживаемые значения сложностей.
            quota = {
                key: max(0, int(value))
                for key, value in difficulty_quota.items()
                if key
                in {
                    ProblemDifficulty.EASY.value,
                    ProblemDifficulty.MEDIUM.value,
                    ProblemDifficulty.HARD.value,
                }
            }
            total_quota = sum(quota.values())
            used = {key: 0 for key in quota.keys()}

        # Локальный набор нормализованных условий, чтобы не плодить дубликаты
        # внутри одного запуска генерации. Исторические данные из БД умышленно
        # не учитываем, чтобы не блокировать генерацию после удаления задач.
        seen_norms: set[str] = set()

        def _points_for_difficulty(diff: str) -> int:
            if diff == ProblemDifficulty.MEDIUM.value:
                return 2
            if diff == ProblemDifficulty.HARD.value:
                return 3
            return 1

        for item in generated:
            # Map difficulty/type from strings to enums expected by ProblemCreate.
            diff_value = item.difficulty

            # Учитываем квоты по сложностям, если они заданы.
            if quota:
                if diff_value not in quota:
                    # Неожиданное значение сложности трактуем как "easy"
                    diff_value = ProblemDifficulty.EASY.value

                if total_quota is not None and sum(used.values()) >= total_quota:
                    break

                if used.get(diff_value, 0) >= quota.get(diff_value, 0):
                    # Квота для этой сложности выбрана, пробуем следующую задачу.
                    continue

            difficulty = ProblemDifficulty(diff_value)

            choices = None
            answer_key = None

            if item.type in ("single_choice", "multiple_choice"):
                if not item.choices:
                    # Без вариантов смысла нет – пропускаем такую задачу.
                    continue
                from app.modules.problems.api.schemas import ProblemChoiceIn

                choices = [
                    ProblemChoiceIn(
                        choice_text=choice.text,
                        is_correct=choice.is_correct,
                        order_no=idx,
                    )
                    for idx, choice in enumerate(item.choices)
                ]

                # Гарантируем, что есть хотя бы один правильный вариант.
                if not any(c.is_correct for c in choices):
                    choices[0].is_correct = True

            elif item.type == "short_text":
                from app.modules.problems.api.schemas import ProblemAnswerKeyIn

                if item.text_answer:
                    answer_key = ProblemAnswerKeyIn(text_answer=item.text_answer)

            # Normalize statement for deduplication и отбрасываем точные дубликаты
            # только внутри текущей выборки сгенерированных задач.
            normalized_statement = normalize_statement_for_dedup(item.statement or "")
            if normalized_statement in seen_norms:
                skipped_duplicates += 1
                continue

            problem_create = ProblemCreate(
                subject_id=subject_uuid,
                topic_id=topic_uuid,
                type=item.type,  # ProblemType is compatible with its string value
                difficulty=difficulty,
                title=item.title,
                statement=item.statement,
                explanation=item.explanation,
                time_limit_sec=60,
                points=_points_for_difficulty(diff_value),
                choices=choices,
                tags=None,
                answer_key=answer_key,
                images=None,
            )

            try:
                # 1) Создаём задачу в статусе draft.
                created = await self.create_draft_problem(
                    problem_create,
                    created_by=created_by,
                )
            except Conflict:
                # Если из-за уникального ограничения в БД задача не создалась,
                # откатываем текущую транзакцию сессии, считаем её дубликатом и идём дальше.
                await self.session.rollback()
                skipped_duplicates += 1
                continue

            # 2) Автоматически отправляем ИИ-задачу на проверку,
            #    чтобы не требовалось ручное нажатие "На проверку".
            try:
                created = await self.submit_for_review(created.id)
            except Conflict:
                # Если по каким-то причинам перевести в pending_review не удалось,
                # оставляем задачу как есть в текущем статусе.
                await self.session.rollback()
                created = await self.repo.get_problem(created.id)

            created_problems.append(created)
            seen_norms.add(normalized_statement)
            if quota:
                used[diff_value] = used.get(diff_value, 0) + 1

        return created_problems, skipped_duplicates

