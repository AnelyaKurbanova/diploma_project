from __future__ import annotations

import secrets
import string
import uuid

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequest, Forbidden, NotFound
from app.modules.classes.data.repo import ClassRepo
from app.modules.dashboard.application.service import DashboardService
from app.modules.problems.data.models import ProblemModel
from app.modules.submissions.data.models import SubmissionModel, SubmissionStatus
from app.modules.users.data.models import UserRole, UserModel
from app.modules.users.data.repo import UserProfileRepo


class ClassService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ClassRepo(session)

    @staticmethod
    def _assert_teacher(current_user) -> None:
        if current_user.role != UserRole.TEACHER:
            raise Forbidden("Доступно только учителям")

    async def _generate_unique_join_code(self, length: int = 8) -> str:
        alphabet = string.ascii_uppercase + string.digits
        alphabet = alphabet.replace("O", "").replace("I", "").replace("0", "").replace("1", "")

        while True:
            code = "".join(secrets.choice(alphabet) for _ in range(length))
            existing = await self.repo.get_by_join_code(code)
            if existing is None:
                return code

    async def create_class(self, current_user, name: str):
        self._assert_teacher(current_user)

        name = (name or "").strip()
        if not name:
            raise BadRequest("Название класса не может быть пустым")

        profiles = UserProfileRepo(self.session)
        profile = await profiles.get_by_user_id(current_user.id)
        school_id = profile.school_id if profile else None

        join_code = await self._generate_unique_join_code()
        row = await self.repo.create_class(
            teacher_id=current_user.id,
            school_id=school_id,
            name=name,
            join_code=join_code,
        )
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def list_my_classes(self, current_user):
        self._assert_teacher(current_user)
        return await self.repo.list_by_teacher(current_user.id)

    async def get_class_for_teacher(self, current_user, class_id: uuid.UUID):
        self._assert_teacher(current_user)
        row = await self.repo.get_by_id(class_id)
        if not row or row.teacher_id != current_user.id:
            raise NotFound("Класс не найден")
        return row

    async def remove_student_from_class(
        self,
        current_user,
        class_id: uuid.UUID,
        student_id: uuid.UUID,
    ) -> None:
        cls = await self.get_class_for_teacher(current_user, class_id)
        await self.repo.remove_student(class_id=cls.id, student_id=student_id)
        await self.session.commit()

    async def delete_class(self, current_user, class_id: uuid.UUID) -> None:
        cls = await self.get_class_for_teacher(current_user, class_id)
        await self.repo.delete_class(cls.id)
        await self.session.commit()

    async def join_by_code(self, current_user, join_code: str):
        if current_user.role != UserRole.STUDENT:
            raise Forbidden("Присоединяться к классам могут только ученики")

        code = (join_code or "").strip().upper()
        if not code:
            raise BadRequest("Код класса не может быть пустым")

        cls = await self.repo.get_by_join_code(code)
        if not cls:
            raise NotFound("Класс с таким кодом не найден")

        try:
            await self.repo.add_student(class_id=cls.id, student_id=current_user.id)
            await self.session.commit()
        except Exception:
            await self.session.rollback()

        return cls

    async def list_my_classes_student(self, current_user):
        if current_user.role != UserRole.STUDENT:
            raise Forbidden("Доступно только ученикам")
        return await self.repo.list_for_student(current_user.id)

    async def get_class_stats_for_teacher(
        self,
        current_user,
        class_id: uuid.UUID,
    ):
        cls = await self.get_class_for_teacher(current_user, class_id)
        students = await self.repo.list_students(cls.id)
        total_students = len(students)
        if total_students == 0:
            return {
                "total_students": 0,
                "avg_overall_progress": 0,
            }

        dashboard = DashboardService(self.session)

        overall_sum = 0
        per_student_progress: dict[uuid.UUID, int] = {}

        for link in students:
            stats = await dashboard.get_stats(link.student_id)
            overall_sum += stats.overall_progress
            per_student_progress[link.student_id] = stats.overall_progress

        avg_overall = round(overall_sum / total_students) if total_students else 0

        return {
            "total_students": total_students,
            "avg_overall_progress": avg_overall,
            "per_student_progress": per_student_progress,
        }

    async def create_assessment_for_teacher(
        self,
        current_user,
        *,
        class_id: uuid.UUID,
        title: str,
        description: str | None,
        due_at,
        time_limit_min: int | None,
        items: list[tuple[uuid.UUID, int]],
    ):
        cls = await self.get_class_for_teacher(current_user, class_id)
        clean_title = title.strip()
        if not clean_title:
            raise BadRequest("Название контрольной не может быть пустым")
        if not items:
            raise BadRequest("Добавьте хотя бы одну задачу в контрольную")

        seen: set[uuid.UUID] = set()
        ordered_problem_ids: list[uuid.UUID] = []
        for problem_id, _points in items:
            if problem_id in seen:
                raise BadRequest("Одна и та же задача не может быть добавлена дважды")
            seen.add(problem_id)
            ordered_problem_ids.append(problem_id)

        problems = await self.repo.list_published_problems_by_ids(ordered_problem_ids)
        found_ids = {p.id for p in problems}
        missing_ids = [pid for pid in ordered_problem_ids if pid not in found_ids]
        if missing_ids:
            raise BadRequest("Некоторые задачи не найдены или не опубликованы")

        assessment = await self.repo.create_assessment(
            class_id=cls.id,
            created_by=current_user.id,
            title=clean_title,
            description=description,
            due_at=due_at,
            time_limit_min=time_limit_min,
        )
        # MVP: newly created assessments are immediately available to students.
        assessment.is_published = True
        await self.repo.add_assessment_items(
            assessment_id=assessment.id,
            items=[
                (problem_id, idx, points)
                for idx, (problem_id, points) in enumerate(items)
            ],
        )
        await self.session.commit()
        await self.session.refresh(assessment)
        return assessment

    async def list_assessments_for_teacher(
        self,
        current_user,
        *,
        class_id: uuid.UUID,
    ):
        cls = await self.get_class_for_teacher(current_user, class_id)
        return await self.repo.list_assessments_by_class(cls.id)

    async def get_assessment_detail_for_teacher(
        self,
        current_user,
        *,
        class_id: uuid.UUID,
        assessment_id: uuid.UUID,
    ):
        cls = await self.get_class_for_teacher(current_user, class_id)
        assessment = await self.repo.get_assessment_by_id(assessment_id)
        if assessment is None or assessment.class_id != cls.id:
            raise NotFound("Контрольная не найдена")

        items = await self.repo.list_assessment_items(assessment.id)
        problem_titles: dict[uuid.UUID, str] = {}
        for item in items:
            problem = await self.session.get(ProblemModel, item.problem_id)
            if problem is not None:
                problem_titles[item.problem_id] = problem.title

        return assessment, items, problem_titles

    async def get_assessment_progress_for_teacher(
        self,
        current_user,
        *,
        class_id: uuid.UUID,
        assessment_id: uuid.UUID,
    ):
        cls = await self.get_class_for_teacher(current_user, class_id)
        assessment = await self.repo.get_assessment_by_id(assessment_id)
        if assessment is None or assessment.class_id != cls.id:
            raise NotFound("Контрольная не найдена")

        items = await self.repo.list_assessment_items(assessment.id)
        students = await self.repo.list_students(cls.id)

        total_items = len(items)
        total_points = sum(item.points for item in items)
        problem_ids = [item.problem_id for item in items]
        points_by_problem = {item.problem_id: item.points for item in items}
        student_ids = [s.student_id for s in students]

        matrix: dict[tuple[uuid.UUID, uuid.UUID], dict[str, int]] = {}
        if student_ids and problem_ids:
            stmt = (
                select(
                    SubmissionModel.user_id.label("student_id"),
                    SubmissionModel.problem_id.label("problem_id"),
                    func.count().label("attempts"),
                    func.max(
                        case(
                            (
                                and_(
                                    SubmissionModel.status == SubmissionStatus.GRADED,
                                    SubmissionModel.is_correct.is_(True),
                                ),
                                1,
                            ),
                            else_=0,
                        )
                    ).label("has_correct"),
                )
                .where(
                    SubmissionModel.user_id.in_(student_ids),
                    SubmissionModel.problem_id.in_(problem_ids),
                    SubmissionModel.assessment_id == assessment.id,
                )
                .group_by(SubmissionModel.user_id, SubmissionModel.problem_id)
            )
            rows = (await self.session.execute(stmt)).all()
            for row in rows:
                key = (row.student_id, row.problem_id)
                matrix[key] = {
                    "attempts": int(row.attempts or 0),
                    "has_correct": int(row.has_correct or 0),
                }

        profiles = UserProfileRepo(self.session)
        students_out: list[dict] = []
        sum_progress = 0
        sum_score = 0

        for link in students:
            user = await self.session.get(UserModel, link.student_id)
            profile = await profiles.get_by_user_id(link.student_id)

            attempted_count = 0
            solved_count = 0
            score = 0
            for problem_id in problem_ids:
                cell = matrix.get((link.student_id, problem_id))
                if cell and cell["attempts"] > 0:
                    attempted_count += 1
                if cell and cell["has_correct"] == 1:
                    solved_count += 1
                    score += points_by_problem.get(problem_id, 0)

            progress_percent = (
                round((solved_count / total_items) * 100) if total_items > 0 else 0
            )
            sum_progress += progress_percent
            sum_score += score

            students_out.append(
                {
                    "student_id": link.student_id,
                    "email": user.email if user else "",
                    "full_name": profile.full_name if profile else None,
                    "attempted_count": attempted_count,
                    "solved_count": solved_count,
                    "total_items": total_items,
                    "progress_percent": progress_percent,
                    "score": score,
                    "total_points": total_points,
                }
            )

        students_count = len(students_out)
        avg_progress = round(sum_progress / students_count) if students_count > 0 else 0
        avg_score = round(sum_score / students_count) if students_count > 0 else 0

        return {
            "assessment_id": assessment.id,
            "class_id": cls.id,
            "class_name": cls.name,
            "assessment_title": assessment.title,
            "total_items": total_items,
            "total_points": total_points,
            "avg_progress_percent": avg_progress,
            "avg_score": avg_score,
            "students": students_out,
        }

    async def list_assessments_for_student(self, current_user):
        if current_user.role != UserRole.STUDENT:
            raise Forbidden("Доступно только ученикам")

        classes = await self.repo.list_for_student(current_user.id)
        class_ids = [c.id for c in classes]
        class_names = {c.id: c.name for c in classes}

        assessments = await self.repo.list_assessments_by_class_ids(
            class_ids,
            only_published=True,
        )

        out: list[dict] = []
        for row in assessments:
            items = await self.repo.list_assessment_items(row.id)
            out.append(
                {
                    "id": row.id,
                    "class_id": row.class_id,
                    "class_name": class_names.get(row.class_id, "Класс"),
                    "title": row.title,
                    "description": row.description,
                    "due_at": row.due_at,
                    "time_limit_min": row.time_limit_min,
                    "items_count": len(items),
                    "total_points": sum(item.points for item in items),
                }
            )
        return out

    async def get_assessment_detail_for_student(
        self,
        current_user,
        *,
        assessment_id: uuid.UUID,
    ):
        if current_user.role != UserRole.STUDENT:
            raise Forbidden("Доступно только ученикам")

        assessment = await self.repo.get_assessment_by_id(assessment_id)
        if assessment is None or not assessment.is_published:
            raise NotFound("Контрольная не найдена")

        classes = await self.repo.list_for_student(current_user.id)
        class_map = {c.id: c for c in classes}
        cls = class_map.get(assessment.class_id)
        if cls is None:
            raise NotFound("Контрольная не найдена")

        items = await self.repo.list_assessment_items(assessment.id)
        problem_titles: dict[uuid.UUID, str] = {}
        for item in items:
            problem = await self.session.get(ProblemModel, item.problem_id)
            if problem is not None:
                problem_titles[item.problem_id] = problem.title

        return {
            "id": assessment.id,
            "class_id": assessment.class_id,
            "class_name": cls.name,
            "title": assessment.title,
            "description": assessment.description,
            "due_at": assessment.due_at,
            "time_limit_min": assessment.time_limit_min,
            "items_count": len(items),
            "total_points": sum(item.points for item in items),
            "items": [
                {
                    "id": item.id,
                    "problem_id": item.problem_id,
                    "problem_title": problem_titles.get(item.problem_id),
                    "order_no": item.order_no,
                    "points": item.points,
                }
                for item in items
            ],
        }
