from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.modules.auth.deps import get_current_user, require_roles
from app.modules.catalog.api.schemas import (
    SubjectCreate,
    SubjectOut,
    SubjectUpdate,
    TopicCreate,
    TopicOut,
    TopicUpdate,
)
from app.modules.catalog.application.service import SubjectService, TopicService
from app.modules.users.data.models import UserRole


router = APIRouter(tags=["catalog"])


def to_subject_out(row, *, topic_count: int = 0) -> SubjectOut:
    return SubjectOut(
        id=row.id,
        code=row.code,
        name_ru=row.name_ru,
        name_kk=row.name_kk,
        name_en=row.name_en,
        description_ru=row.description_ru,
        description_kk=row.description_kk,
        description_en=row.description_en,
        topic_count=topic_count,
        created_at=row.created_at,
    )


def to_topic_out(row) -> TopicOut:
    return TopicOut(
        id=row.id,
        subject_id=row.subject_id,
        parent_topic_id=row.parent_topic_id,
        title_ru=row.title_ru,
        title_kk=row.title_kk,
        title_en=row.title_en,
        grade_level=row.grade_level,
        order_no=row.order_no,
        created_at=row.created_at,
    )


@router.post(
    "/subjects",
    response_model=SubjectOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_subject(
    body: SubjectCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = SubjectService(session)
    row = await svc.create(body)
    return to_subject_out(row)


@router.get("/subjects", response_model=list[SubjectOut])
async def list_subjects(
    session: AsyncSession = Depends(get_session),
):
    svc = SubjectService(session)
    rows = await svc.list_with_topic_counts()
    return [to_subject_out(row, topic_count=cnt) for row, cnt in rows]


@router.get("/subjects/{subject_id}", response_model=SubjectOut)
async def get_subject(
    subject_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    svc = SubjectService(session)
    row, cnt = await svc.get_with_topic_count(subject_id)
    return to_subject_out(row, topic_count=cnt)


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
async def update_subject(
    subject_id: uuid.UUID,
    body: SubjectUpdate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = SubjectService(session)
    row = await svc.update(subject_id, body)
    return to_subject_out(row)


@router.delete(
    "/subjects/{subject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_subject(
    subject_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = SubjectService(session)
    await svc.delete(subject_id)
    return None


@router.post(
    "/topics",
    response_model=TopicOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_topic(
    body: TopicCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = TopicService(session)
    row = await svc.create(body)
    return to_topic_out(row)


@router.get("/topics", response_model=list[TopicOut])
async def list_topics(
    subject_id: uuid.UUID | None = Query(default=None),
    parent_topic_id: uuid.UUID | None = Query(default=None),
    grade_level: int | None = Query(default=None, ge=1, le=11),
    session: AsyncSession = Depends(get_session),
):
    svc = TopicService(session)
    rows = await svc.list(
        subject_id=subject_id,
        parent_topic_id=parent_topic_id,
        grade_level=grade_level,
    )
    return [to_topic_out(r) for r in rows]


@router.get("/topics/{topic_id}", response_model=TopicOut)
async def get_topic(
    topic_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    svc = TopicService(session)
    row = await svc.get(topic_id)
    return to_topic_out(row)


@router.patch("/topics/{topic_id}", response_model=TopicOut)
async def update_topic(
    topic_id: uuid.UUID,
    body: TopicUpdate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = TopicService(session)
    row = await svc.update(topic_id, body)
    return to_topic_out(row)


@router.delete(
    "/topics/{topic_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_topic(
    topic_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(
        require_roles(
            UserRole.CONTENT_MAKER,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        )
    ),
):
    svc = TopicService(session)
    await svc.delete(topic_id)
    return None

