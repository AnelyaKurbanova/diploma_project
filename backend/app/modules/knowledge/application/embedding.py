from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
_model: "SentenceTransformer | None" = None


def _get_model() -> "SentenceTransformer":
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        logger.info("Loading embedding model: %s", _MODEL_NAME)
        _model = SentenceTransformer(_MODEL_NAME)
        logger.info("Embedding model loaded successfully")
    return _model


def preload_model() -> None:
    """Pre-load the embedding model at startup (call from lifespan)."""
    _get_model()


def embed(text: str) -> list[float]:
    """Compute embedding for a single text (synchronous)."""
    model = _get_model()
    return model.encode(text, convert_to_numpy=True).tolist()


def embed_batch(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """Compute embeddings for a batch of texts (synchronous)."""
    if not texts:
        return []
    model = _get_model()
    embeddings = model.encode(texts, batch_size=batch_size, convert_to_numpy=True)
    return [emb.tolist() for emb in embeddings]


async def embed_async(text: str) -> list[float]:
    """Async wrapper — runs embedding in a thread to avoid blocking the event loop."""
    return await asyncio.to_thread(embed, text)


async def embed_batch_async(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """Async wrapper — runs batch embedding in a thread to avoid blocking the event loop."""
    return await asyncio.to_thread(embed_batch, texts, batch_size)
