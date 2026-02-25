from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.knowledge.data.models import RagChunkModel, RagDocumentModel


class KnowledgeRepo:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_document(
        self,
        *,
        filename: str,
        subject_code: str,
    ) -> RagDocumentModel:
        doc = RagDocumentModel(
            filename=filename,
            subject_code=subject_code,
        )
        self.session.add(doc)
        await self.session.flush()
        return doc

    async def create_chunk(
        self,
        *,
        document_id: uuid.UUID,
        content: str,
        embedding: list[float],
        section: str | None,
        chunk_index: int,
        metadata: dict | None = None,
    ) -> RagChunkModel:
        chunk = RagChunkModel(
            document_id=document_id,
            content=content,
            embedding=embedding,
            section=section,
            chunk_index=chunk_index,
            chunk_metadata=metadata,
        )
        self.session.add(chunk)
        await self.session.flush()
        return chunk

    async def search(
        self,
        query_embedding: list[float],
        *,
        subject_code: str | None = None,
        k: int = 12,
    ) -> list[RagChunkModel]:
        stmt = (
            select(RagChunkModel)
            .join(RagDocumentModel, RagChunkModel.document_id == RagDocumentModel.id)
            .order_by(RagChunkModel.embedding.cosine_distance(query_embedding))
            .limit(k)
        )
        if subject_code is not None:
            stmt = stmt.where(RagDocumentModel.subject_code == subject_code)

        result = await self.session.execute(stmt)
        rows: Sequence[RagChunkModel] = result.scalars().all()
        return list(rows)
