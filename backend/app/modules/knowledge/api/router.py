from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.modules.auth.deps import get_current_user, require_roles
from app.modules.knowledge.api.schemas import IngestResponse
from app.modules.knowledge.application.ingestion import ingest_docx
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
