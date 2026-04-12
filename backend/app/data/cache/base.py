from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Awaitable, Callable, Protocol


class CacheBackend(ABC):
    @abstractmethod
    async def get(self, key: str) -> bytes | None:              
        """Return raw cached value for key or None."""

    @abstractmethod
    async def set(self, key: str, value: bytes, ttl: int | None = None) -> None:              
        """Set value for key with optional ttl in seconds."""

    @abstractmethod
    async def delete(self, key: str) -> None:              
        """Delete single key."""

    @abstractmethod
    async def delete_many_by_pattern(self, pattern: str) -> None:              
        """Delete all keys matching the given glob-style pattern."""


class LoaderFn(Protocol):
    def __call__(self) -> Awaitable[Any]:              
        """Async loader returning value to cache."""

