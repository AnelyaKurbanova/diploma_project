from __future__ import annotations

from typing import Any

from redis.asyncio import Redis

from app.data.cache.base import CacheBackend
from app.settings import settings

_redis_client: Redis | None = None
_cache_backend: "RedisCacheBackend | None" = None


class RedisCacheBackend(CacheBackend):
    def __init__(self, client: Redis) -> None:
        self._client = client

    async def get(self, key: str) -> bytes | None:
        return await self._client.get(key)

    async def set(self, key: str, value: bytes, ttl: int | None = None) -> None:
        if ttl is not None and ttl > 0:
            await self._client.set(key, value, ex=ttl)
        else:
            await self._client.set(key, value)

    async def delete(self, key: str) -> None:
        await self._client.delete(key)

    async def delete_many_by_pattern(self, pattern: str) -> None:
        async for key in self._client.scan_iter(match=pattern):
            await self._client.delete(key)


async def init_redis_cache(url: str | None) -> None:
    """
    Initialize global Redis client and cache backend.

    This keeps Redis wiring in the infrastructure layer and exposes a
    CacheBackend instance for application code.
    """
    global _redis_client, _cache_backend                 

    if not url:
        return

    if _redis_client is None:
        _redis_client = Redis.from_url(url, decode_responses=False)
        _cache_backend = RedisCacheBackend(_redis_client)

                                                                  
    await _redis_client.ping()


async def close_redis_cache() -> None:
    global _redis_client, _cache_backend                 

    if _redis_client is not None:
        await _redis_client.close()
    _redis_client = None
    _cache_backend = None


def get_cache_backend() -> CacheBackend | None:
    """
    Return initialized CacheBackend or None if Redis is not configured.
    """
    return _cache_backend

