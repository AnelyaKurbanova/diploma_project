
from __future__ import annotations

from app.modules.auth.security.tokens import hash_value, secure_compare


def hash_teacher_code(plain: str) -> str:
    """Hash a teacher code for storage. Plain must not be stored or logged."""
    return hash_value(plain)


def verify_teacher_code(plain: str, hash_from_db: str) -> bool:
    """Verify a teacher code against the stored hash. Constant-time comparison."""
    if not hash_from_db:
        return False
    return secure_compare(hash_value(plain), hash_from_db)
