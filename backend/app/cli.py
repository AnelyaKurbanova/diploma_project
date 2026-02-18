from __future__ import annotations

import asyncio
import sys

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.settings import settings
from app.core.security import hash_teacher_code
from app.modules.schools.data.models import SchoolModel


async def add_school(name: str, teacher_code: str) -> None:
    engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    async with SessionLocal() as session:
        school = SchoolModel(
            name=name,
            teacher_code_hash=hash_teacher_code(teacher_code),
        )
        session.add(school)
        await session.commit()
        print(f"School created: id={school.id}, name={school.name}")


def main() -> None:
    if len(sys.argv) < 4 or sys.argv[1] != "add_school":
        print("Usage: python -m app.cli add_school \"School Name\" \"teacher_code\"")
        sys.exit(1)
    name = sys.argv[2]
    code = sys.argv[3]
    if not name.strip():
        print("Error: school name is required")
        sys.exit(1)
    if not code.strip():
        print("Error: teacher code is required")
        sys.exit(1)
    asyncio.run(add_school(name.strip(), code))


if __name__ == "__main__":
    main()
