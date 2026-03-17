from __future__ import annotations

import pickle
from dataclasses import dataclass
from typing import Awaitable, Callable, TypeVar

from app.data.cache.base import CacheBackend
from app.data.cache.redis_backend import get_cache_backend
from app.settings import settings

T = TypeVar("T")


@dataclass
class CacheNamespace:
    catalog_subjects: str = "catalog:subjects"
    catalog_topics: str = "catalog:topics"
    catalog_problems: str = "catalog:problems"


NAMESPACE = CacheNamespace()


class CacheService:
    def __init__(self, backend: CacheBackend | None, default_ttl: int | None = None) -> None:
        self._backend = backend
        self._default_ttl = default_ttl or settings.REDIS_CACHE_TTL_DEFAULT

    def is_enabled(self) -> bool:
        return self._backend is not None

    async def get_or_set(
        self,
        key: str,
        loader: Callable[[], Awaitable[T]],
        ttl: int | None = None,
    ) -> T:
        """
        Generic read-through cache helper.

        - If backend is disabled or key is missing, calls loader() and caches result.
        - Values are serialized with pickle; caller получает те же Python-объекты.
        """
        if self._backend is None:
            return await loader()

        cached = await self._backend.get(key)
        if cached is not None:
            return pickle.loads(cached)

        value = await loader()
        raw = pickle.dumps(value)
        await self._backend.set(key, raw, ttl=ttl or self._default_ttl)
        return value

    async def invalidate_key(self, key: str) -> None:
        if self._backend is None:
            return
        await self._backend.delete(key)

    async def invalidate_pattern(self, pattern: str) -> None:
        if self._backend is None:
            return
        await self._backend.delete_many_by_pattern(pattern)


def get_cache_service() -> CacheService:
    """
    Factory used from DI wiring (routers/services).
    """
    backend = get_cache_backend()
    return CacheService(backend=backend, default_ttl=settings.REDIS_CACHE_TTL_DEFAULT)

