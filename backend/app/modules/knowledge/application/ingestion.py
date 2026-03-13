from __future__ import annotations

from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.knowledge.application.embedding import embed_batch
from app.modules.knowledge.data.models import RagDocumentModel
from app.modules.knowledge.data.repo import KnowledgeRepo

# Approximate tokens: ~4 chars per token for Russian/mixed content
CHARS_PER_TOKEN = 4
MAX_CHUNK_TOKENS = 600
OVERLAP_TOKENS = 100
MAX_CHUNK_CHARS = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN
OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN


def _convert_docx_to_markdown(file_path: Path) -> str:
    import pypandoc

    return pypandoc.convert_file(str(file_path), "md", format="docx")


def _split_into_sections(md: str) -> list[tuple[str | None, str]]:
    """Split markdown into (section_title, content) pairs by ## or ### headers."""
    sections: list[tuple[str | None, str]] = []
    lines = md.split("\n")
    current_section: str | None = None
    current_content: list[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("## ") or stripped.startswith("### "):
            if current_content:
                text = "\n".join(current_content).strip()
                if text:
                    sections.append((current_section, text))
            current_section = stripped.lstrip("#").strip()
            current_content = []
        else:
            current_content.append(line)

    if current_content:
        text = "\n".join(current_content).strip()
        if text:
            sections.append((current_section, text))

    if not sections and md.strip():
        sections.append((None, md.strip()))

    return sections


def _split_large_section(content: str, section: str | None) -> list[tuple[str | None, str]]:
    """If content exceeds MAX_CHUNK_CHARS, split by paragraphs with overlap."""
    if len(content) <= MAX_CHUNK_CHARS:
        return [(section, content)]

    result: list[tuple[str | None, str]] = []
    paragraphs = content.split("\n\n")
    current: list[str] = []
    current_len = 0

    for p in paragraphs:
        p_len = len(p) + 2  # +2 for \n\n
        if current_len + p_len > MAX_CHUNK_CHARS and current:
            chunk_text = "\n\n".join(current)
            result.append((section, chunk_text))
            # Overlap: keep last N chars
            overlap_text = chunk_text[-OVERLAP_CHARS:] if len(chunk_text) > OVERLAP_CHARS else chunk_text
            # Start next chunk with overlap (try to start at paragraph boundary)
            overlap_paragraphs = overlap_text.split("\n\n")
            current = [overlap_paragraphs[-1]] if overlap_paragraphs else []
            current_len = sum(len(x) + 2 for x in current)
        current.append(p)
        current_len += p_len

    if current:
        result.append((section, "\n\n".join(current)))

    return result


def _build_chunks(md: str) -> list[tuple[str | None, str]]:
    sections = _split_into_sections(md)
    chunks: list[tuple[str | None, str]] = []
    for section, content in sections:
        chunks.extend(_split_large_section(content, section))
    return chunks


async def ingest_docx(
    session: AsyncSession,
    file_path: Path,
    subject_code: str,
) -> tuple[RagDocumentModel, int]:
    """Convert docx to markdown, chunk, embed and store in the knowledge base."""
    md = _convert_docx_to_markdown(file_path)
    chunk_pairs = _build_chunks(md)

    repo = KnowledgeRepo(session)
    doc = await repo.create_document(
        filename=file_path.name,
        subject_code=subject_code,
    )

    contents = [c[1] for c in chunk_pairs]
    embeddings = embed_batch(contents)

    for idx, ((section, content), embedding) in enumerate(zip(chunk_pairs, embeddings)):
        await repo.create_chunk(
            document_id=doc.id,
            content=content,
            embedding=embedding,
            section=section,
            chunk_index=idx,
            metadata={"section": section} if section else None,
        )

    await session.commit()
    await session.refresh(doc)
    return doc, len(chunk_pairs)
