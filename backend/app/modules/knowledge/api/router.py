from __future__ import annotations

import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.modules.auth.deps import require_roles
from app.modules.knowledge.api.schemas import DocumentOut, IngestResponse
from app.modules.knowledge.application.ingestion import ingest_docx
from app.modules.knowledge.data.repo import KnowledgeRepo
from app.modules.users.data.models import UserRole

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.post(
    "/ingest",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def ingest_document(
    file: UploadFile = File(...),
    subject_code: str = Form(..., min_length=1, max_length=64),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.MODERATOR, UserRole.ADMIN)),
):
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)
    try:
        doc, chunks_count = await ingest_docx(session, tmp_path, subject_code)
        return IngestResponse(
            document_id=doc.id,
            chunks_count=chunks_count,
        )
    finally:
        tmp_path.unlink(missing_ok=True)


@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(
    subject_code: str | None = Query(default=None, max_length=64),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.MODERATOR, UserRole.ADMIN)),
):
    repo = KnowledgeRepo(session)
    rows = await repo.list_documents(subject_code=subject_code)
    return [
        DocumentOut(
            id=doc.id,
            filename=doc.filename,
            subject_code=doc.subject_code,
            uploaded_at=doc.uploaded_at,
            chunks_count=count,
        )
        for doc, count in rows
    ]


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_document(
    document_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles(UserRole.MODERATOR, UserRole.ADMIN)),
):
    repo = KnowledgeRepo(session)
    await repo.delete_document(document_id)
    await session.commit()
    return None
