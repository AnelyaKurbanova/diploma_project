from __future__ import annotations
import asyncio
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from app.core.errors import TooManyRequests


@dataclass
class LimitResult:
    allowed: bool
    retry_after_seconds: int = 0


class InMemoryRateLimiter:
    def __init__(self):
        self._store: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def hit(self, key: str, limit: int, window_seconds: int) -> LimitResult:
        now = time.time()
        async with self._lock:
            q = self._store[key]
            while q and q[0] < now - window_seconds:
                q.popleft()

            if len(q) >= limit:
                retry_after = int(max(1, window_seconds - (now - q[0])))
                return LimitResult(False, retry_after)

            q.append(now)
            return LimitResult(True, 0)


class RedisRateLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client

    async def hit(self, key: str, limit: int, window_seconds: int) -> LimitResult:
        redis_key = f"rl:{key}"
        count = await self.redis.incr(redis_key)
        if count == 1:
            await self.redis.expire(redis_key, window_seconds)

        if count > limit:
            ttl = await self.redis.ttl(redis_key)
            return LimitResult(False, int(ttl if ttl and ttl > 0 else window_seconds))
        return LimitResult(True, 0)


class RateLimitService:
    def __init__(self, backend):
        self.backend = backend

    async def enforce(self, key: str, limit: int, window_seconds: int, message: str | None = None):
        from app.core.i18n import tr

        result = await self.backend.hit(key=key, limit=limit, window_seconds=window_seconds)
        if not result.allowed:
            msg = message or tr("too_many_requests")
            raise TooManyRequests(f"{msg}. {tr('retry_in', seconds=result.retry_after_seconds)}")
