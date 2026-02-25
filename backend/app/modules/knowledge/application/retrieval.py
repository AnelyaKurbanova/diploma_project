from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.knowledge.application.embedding import embed
from app.modules.knowledge.data.models import RagChunkModel
from app.modules.knowledge.data.repo import KnowledgeRepo


async def search(
    session: AsyncSession,
    query: str,
    *,
    subject_code: str | None = None,
    k: int = 12,
) -> list[RagChunkModel]:
    """Search knowledge base by semantic similarity."""
    query_embedding = embed(query)
    repo = KnowledgeRepo(session)
    return await repo.search(
        query_embedding,
        subject_code=subject_code,
        k=k,
    )
