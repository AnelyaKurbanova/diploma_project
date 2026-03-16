from __future__ import annotations

import uuid
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, Depends, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.settings import settings
from app.modules.auth.deps import get_current_user
from app.modules.auth.infra.ratelimit import RateLimitService, InMemoryRateLimiter, RedisRateLimiter
from app.modules.chat.api.schemas import (
    ConversationCreate,
    ConversationOut,
    MessageCreate,
    MessageOut,
    UsageOut,
)
from app.modules.chat.application.service import ChatService


router = APIRouter(prefix="/chat", tags=["chat"])

_CHAT_RL: RateLimitService | None = None


def _get_chat_rate_limiter() -> RateLimitService:
    global _CHAT_RL
    if _CHAT_RL is None:
        if settings.REDIS_URL:
            from redis.asyncio import from_url as redis_from_url
            _CHAT_RL = RateLimitService(
                RedisRateLimiter(redis_from_url(settings.REDIS_URL, decode_responses=True)),
            )
        else:
            _CHAT_RL = RateLimitService(InMemoryRateLimiter())
    return _CHAT_RL


@router.post("/conversations", response_model=ConversationOut)
async def create_or_get_conversation(
    body: ConversationCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = ChatService(session)
    conv = await svc.get_or_create_conversation(
        user_id=current_user.id,
        context_type=body.context_type,
        lesson_id=body.lesson_id,
        problem_id=body.problem_id,
    )
    return conv


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def get_messages(
    conversation_id: uuid.UUID,
    before: uuid.UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = ChatService(session)
    messages = await svc.get_messages(
        conversation_id=conversation_id,
        user_id=current_user.id,
        before_id=before,
    )
    return messages


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: uuid.UUID,
    body: MessageCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    rl = _get_chat_rate_limiter()
    await rl.enforce(key=f"chat:user:{current_user.id}", limit=30, window_seconds=60)
    svc = ChatService(session)
    return StreamingResponse(
        svc.send_message(
            conversation_id=conversation_id,
            user_id=current_user.id,
            content=body.content,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.post("/conversations/{conversation_id}/hint")
async def send_hint(
    conversation_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    rl = _get_chat_rate_limiter()
    await rl.enforce(key=f"chat:user:{current_user.id}", limit=30, window_seconds=60)
    svc = ChatService(session)
    return StreamingResponse(
        svc.send_hint(
            conversation_id=conversation_id,
            user_id=current_user.id,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get("/usage", response_model=UsageOut)
async def get_usage(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    svc = ChatService(session)
    return await svc.get_usage(current_user.id)


# ── Aika RAG endpoints ──


@router.post("/aika/upload")
async def upload_file_for_rag(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Upload a file (txt, md, docx) and ingest into pgvector for RAG."""
    from app.modules.knowledge.application.ingestion import ingest_docx, _build_chunks
    from app.modules.knowledge.application.embedding import embed_batch
    from app.modules.knowledge.data.repo import KnowledgeRepo

    filename = file.filename or "upload"
    suffix = Path(filename).suffix.lower()

    if suffix == ".docx":
        with NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp.flush()
            doc, count = await ingest_docx(session, Path(tmp.name), f"user:{current_user.id}")
        return {"document_id": str(doc.id), "filename": filename, "chunks": count}

    elif suffix in (".txt", ".md"):
        raw = (await file.read()).decode("utf-8", errors="replace")
        chunks = _build_chunks(raw)
        repo = KnowledgeRepo(session)
        doc = await repo.create_document(filename=filename, subject_code=f"user:{current_user.id}")
        contents = [c[1] for c in chunks]
        embeddings = embed_batch(contents)
        for idx, ((section, content), embedding) in enumerate(zip(chunks, embeddings)):
            await repo.create_chunk(
                document_id=doc.id, content=content, embedding=embedding,
                section=section, chunk_index=idx,
            )
        await session.commit()
        return {"document_id": str(doc.id), "filename": filename, "chunks": len(chunks)}

    else:
        from app.core.errors import BadRequest
        raise BadRequest("Поддерживаются файлы .txt, .md, .docx")


@router.get("/aika/documents")
async def list_user_documents(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    from app.modules.knowledge.data.repo import KnowledgeRepo
    repo = KnowledgeRepo(session)
    docs = await repo.list_documents(subject_code=f"user:{current_user.id}")
    return [
        {"id": str(doc.id), "filename": doc.filename, "chunks": count, "uploaded_at": doc.uploaded_at.isoformat()}
        for doc, count in docs
    ]


@router.delete("/aika/documents/{document_id}")
async def delete_user_document(
    document_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    from app.modules.knowledge.data.repo import KnowledgeRepo
    repo = KnowledgeRepo(session)
    doc = await repo.get_document(document_id)
    if doc.subject_code != f"user:{current_user.id}":
        from app.core.errors import Forbidden
        raise Forbidden("Не ваш документ")
    await repo.delete_document(document_id)
    await session.commit()
    return {"ok": True}


@router.post("/aika/messages")
async def send_rag_message(
    body: MessageCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """RAG-based chat — searches user's uploaded documents for context."""
    rl = _get_chat_rate_limiter()
    await rl.enforce(key=f"chat:user:{current_user.id}", limit=30, window_seconds=60)
    svc = ChatService(session)
    return StreamingResponse(
        svc.send_rag_message(
            user_id=current_user.id,
            content=body.content,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
