from __future__ import annotations

from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from .settings import Settings


def create_engine(settings: Settings) -> AsyncEngine:
    """Create an async SQLAlchemy engine for Postgres."""

    return create_async_engine(settings.postgres_dsn, future=True)


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Create an async session factory bound to the given engine."""

    return async_sessionmaker(engine, expire_on_commit=False)


async def get_session(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[AsyncSession]:
    """Async context manager-style helper for acquiring a session.

    Usage:
        async with anext(get_session(session_factory)) as session:
            ...
    In most cases, prefer using `async with session_factory() as session` directly.
    """

    async with session_factory() as session:
        yield session

