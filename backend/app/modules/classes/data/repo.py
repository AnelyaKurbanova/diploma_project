from __future__ import annotations

import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.classes.data.models import (
  ClassAssessmentItemModel,
  ClassAssessmentModel,
  ClassModel,
  ClassStudentModel,
)
from app.modules.problems.data.models import ProblemModel, ProblemStatus


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

  async def create_assessment(
    self,
    *,
    class_id: uuid.UUID,
    created_by: uuid.UUID | None,
    title: str,
    description: str | None,
    due_at,
    time_limit_min: int | None,
  ) -> ClassAssessmentModel:
    row = ClassAssessmentModel(
      class_id=class_id,
      created_by=created_by,
      title=title,
      description=description,
      due_at=due_at,
      time_limit_min=time_limit_min,
    )
    self.session.add(row)
    await self.session.flush()
    return row

  async def add_assessment_items(
    self,
    *,
    assessment_id: uuid.UUID,
    items: list[tuple[uuid.UUID, int, int]],
  ) -> list[ClassAssessmentItemModel]:
    rows: list[ClassAssessmentItemModel] = []
    for problem_id, order_no, points in items:
      row = ClassAssessmentItemModel(
        assessment_id=assessment_id,
        problem_id=problem_id,
        order_no=order_no,
        points=points,
      )
      self.session.add(row)
      rows.append(row)
    await self.session.flush()
    return rows

  async def list_assessments_by_class(
    self,
    class_id: uuid.UUID,
  ) -> list[ClassAssessmentModel]:
    stmt: Select[tuple[ClassAssessmentModel]] = (
      select(ClassAssessmentModel)
      .where(ClassAssessmentModel.class_id == class_id)
      .order_by(ClassAssessmentModel.created_at.desc())
    )
    result = await self.session.execute(stmt)
    return list(result.scalars().all())

  async def list_assessments_by_class_ids(
    self,
    class_ids: list[uuid.UUID],
    *,
    only_published: bool = False,
  ) -> list[ClassAssessmentModel]:
    if not class_ids:
      return []
    stmt: Select[tuple[ClassAssessmentModel]] = (
      select(ClassAssessmentModel)
      .where(ClassAssessmentModel.class_id.in_(class_ids))
      .order_by(ClassAssessmentModel.created_at.desc())
    )
    if only_published:
      stmt = stmt.where(ClassAssessmentModel.is_published.is_(True))
    result = await self.session.execute(stmt)
    return list(result.scalars().all())

  async def get_assessment_by_id(
    self,
    assessment_id: uuid.UUID,
  ) -> ClassAssessmentModel | None:
    return await self.session.get(ClassAssessmentModel, assessment_id)

  async def list_assessment_items(
    self,
    assessment_id: uuid.UUID,
  ) -> list[ClassAssessmentItemModel]:
    stmt: Select[tuple[ClassAssessmentItemModel]] = (
      select(ClassAssessmentItemModel)
      .where(ClassAssessmentItemModel.assessment_id == assessment_id)
      .order_by(ClassAssessmentItemModel.order_no.asc())
    )
    result = await self.session.execute(stmt)
    return list(result.scalars().all())

  async def list_published_problems_by_ids(
    self,
    problem_ids: list[uuid.UUID],
  ) -> list[ProblemModel]:
    if not problem_ids:
      return []
    stmt: Select[tuple[ProblemModel]] = (
      select(ProblemModel)
      .where(
        ProblemModel.id.in_(problem_ids),
        ProblemModel.status == ProblemStatus.PUBLISHED,
      )
    )
    result = await self.session.execute(stmt)
    return list(result.scalars().all())
