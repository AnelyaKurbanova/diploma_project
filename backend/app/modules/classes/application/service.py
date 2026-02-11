from __future__ import annotations

import secrets
import string
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequest, Forbidden, NotFound
from app.modules.classes.data.repo import ClassRepo
from app.modules.dashboard.application.service import DashboardService
from app.modules.users.data.models import UserRole, UserModel
from app.modules.users.data.repo import UserProfileRepo


class ClassService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ClassRepo(session)

    # ------------------------------------------------------------------ #
    # Helpers                                                            #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _assert_teacher(current_user) -> None:
        if current_user.role != UserRole.TEACHER:
            raise Forbidden("Доступно только учителям")

    async def _generate_unique_join_code(self, length: int = 8) -> str:
        alphabet = string.ascii_uppercase + string.digits
        # Исключаем потенциально двусмысленные символы
        alphabet = alphabet.replace("O", "").replace("I", "").replace("0", "").replace("1", "")

        while True:
            code = "".join(secrets.choice(alphabet) for _ in range(length))
            existing = await self.repo.get_by_join_code(code)
            if existing is None:
                return code

    # ------------------------------------------------------------------ #
    # Teacher-facing operations                                          #
    # ------------------------------------------------------------------ #

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

    async def list_students_for_teacher(self, current_user, class_id: uuid.UUID):
        cls = await self.get_class_for_teacher(current_user, class_id)
        return await self.repo.list_students(cls.id)

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

    # ------------------------------------------------------------------ #
    # Student-facing operations                                          #
    # ------------------------------------------------------------------ #

    async def join_by_code(self, current_user, join_code: str):
        if current_user.role != UserRole.STUDENT:
            raise Forbidden("Присоединяться к классам могут только ученики")

        code = (join_code or "").strip().upper()
        if not code:
            raise BadRequest("Код класса не может быть пустым")

        cls = await self.repo.get_by_join_code(code)
        if not cls:
            raise NotFound("Класс с таким кодом не найден")

        # Попробуем добавить ученика; если уже есть уникальное ограничение просто проглотим
        try:
            await self.repo.add_student(class_id=cls.id, student_id=current_user.id)
            await self.session.commit()
        except Exception:  # pragma: no cover - защитный код, конкретную ошибку перехватит БД
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
        """Простая версия статистики по классу.

        Сейчас считаем средний overall_progress по ученикам,
        используя существующий DashboardService.
        """
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


