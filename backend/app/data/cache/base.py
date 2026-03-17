from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Awaitable, Callable, Protocol


class CacheBackend(ABC):
    @abstractmethod
    async def get(self, key: str) -> bytes | None:  # noqa: D401
        """Return raw cached value for key or None."""

    @abstractmethod
    async def set(self, key: str, value: bytes, ttl: int | None = None) -> None:  # noqa: D401
        """Set value for key with optional ttl in seconds."""

    @abstractmethod
    async def delete(self, key: str) -> None:  # noqa: D401
        """Delete single key."""

    @abstractmethod
    async def delete_many_by_pattern(self, pattern: str) -> None:  # noqa: D401
        """Delete all keys matching the given glob-style pattern."""


class LoaderFn(Protocol):
    def __call__(self) -> Awaitable[Any]:  # noqa: D401
        """Async loader returning value to cache."""

