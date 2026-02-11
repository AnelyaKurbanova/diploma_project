from __future__ import annotations

import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.classes.data.models import ClassModel, ClassStudentModel


class ClassRepo:
  def __init__(self, session: AsyncSession):
    self.session = session

  async def create_class(
    self,
    *,
    teacher_id: uuid.UUID,
    school_id: uuid.UUID | None,
    name: str,
    join_code: str,
  ) -> ClassModel:
    row = ClassModel(
      teacher_id=teacher_id,
      school_id=school_id,
      name=name,
      join_code=join_code,
    )
    self.session.add(row)
    await self.session.flush()
    return row

  async def get_by_id(self, class_id: uuid.UUID) -> ClassModel | None:
    return await self.session.get(ClassModel, class_id)

  async def get_by_join_code(self, join_code: str) -> ClassModel | None:
    stmt: Select[tuple[ClassModel]] = select(ClassModel).where(
      ClassModel.join_code == join_code,
    )
    result = await self.session.execute(stmt)
    return result.scalars().first()

  async def list_by_teacher(self, teacher_id: uuid.UUID) -> list[ClassModel]:
    stmt: Select[tuple[ClassModel]] = (
      select(ClassModel)
      .where(ClassModel.teacher_id == teacher_id)
      .order_by(ClassModel.created_at.desc())
    )
    result = await self.session.execute(stmt)
    return list(result.scalars().all())

  async def list_for_student(self, student_id: uuid.UUID) -> list[ClassModel]:
    stmt: Select[tuple[ClassModel]] = (
      select(ClassModel)
      .join(ClassStudentModel, ClassStudentModel.class_id == ClassModel.id)
      .where(ClassStudentModel.student_id == student_id)
      .order_by(ClassModel.created_at.desc())
    )
    result = await self.session.execute(stmt)
    return list(result.scalars().all())

  async def list_students(self, class_id: uuid.UUID) -> list[ClassStudentModel]:
    stmt: Select[tuple[ClassStudentModel]] = (
      select(ClassStudentModel)
      .where(ClassStudentModel.class_id == class_id)
      .order_by(ClassStudentModel.created_at.asc())
    )
    result = await self.session.execute(stmt)
    return list(result.scalars().all())

  async def add_student(
    self,
    *,
    class_id: uuid.UUID,
    student_id: uuid.UUID,
  ) -> ClassStudentModel:
    row = ClassStudentModel(
      class_id=class_id,
      student_id=student_id,
    )
    self.session.add(row)
    await self.session.flush()
    return row

  async def remove_student(
    self,
    *,
    class_id: uuid.UUID,
    student_id: uuid.UUID,
  ) -> None:
    stmt: Select[tuple[ClassStudentModel]] = select(ClassStudentModel).where(
      ClassStudentModel.class_id == class_id,
      ClassStudentModel.student_id == student_id,
    )
    result = await self.session.execute(stmt)
    row = result.scalars().first()
    if row is not None:
      await self.session.delete(row)

  async def count_students(self, class_id: uuid.UUID) -> int:
    stmt = (
      select(func.count())
      .select_from(ClassStudentModel)
      .where(ClassStudentModel.class_id == class_id)
    )
    result = await self.session.execute(stmt)
    return int(result.scalar_one())

  async def delete_class(self, class_id: uuid.UUID) -> None:
    row = await self.session.get(ClassModel, class_id)
    if row is not None:
      await self.session.delete(row)

