from __future__ import annotations

from typing import Any

import pytest
from redis.asyncio import Redis

from app.core.cache import CacheService, NAMESPACE
from app.data.cache.redis_backend import RedisCacheBackend


@pytest.mark.asyncio
async def test_cache_service_get_or_set_roundtrip(redis_url: str = "redis://localhost:6379/15") -> None:
    client = Redis.from_url(redis_url, decode_responses=False)
    backend = RedisCacheBackend(client)
    service = CacheService(backend=backend, default_ttl=60)

    key = f"{NAMESPACE.catalog_subjects}:test_roundtrip"

    async def _loader() -> dict[str, Any]:
        return {"value": 42}

    await backend.delete(key)

    first = await service.get_or_set(key, _loader)
    second = await service.get_or_set(key, _loader)

    assert first == {"value": 42}
    assert second == {"value": 42}

    await backend.delete(key)
    await client.close()


@pytest.mark.asyncio
async def test_cache_service_invalidate_pattern(redis_url: str = "redis://localhost:6379/15") -> None:
    client = Redis.from_url(redis_url, decode_responses=False)
    backend = RedisCacheBackend(client)
    service = CacheService(backend=backend, default_ttl=60)

    key1 = f"{NAMESPACE.catalog_subjects}:k1"
    key2 = f"{NAMESPACE.catalog_subjects}:k2"

    await backend.set(key1, b"1", ttl=60)
    await backend.set(key2, b"2", ttl=60)

    await service.invalidate_pattern(f"{NAMESPACE.catalog_subjects}:*")

    assert await backend.get(key1) is None
    assert await backend.get(key2) is None

    await client.close()

