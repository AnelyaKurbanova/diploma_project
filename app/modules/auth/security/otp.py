from __future__ import annotations
from datetime import datetime, timedelta, timezone
from app.settings import settings
from app.modules.auth.security.tokens import gen_otp, hash_value, secure_compare


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def generate_otp_code() -> str:
    return gen_otp()


def hash_otp_code(code: str) -> str:
    return hash_value(code)


def verify_otp_code(code_plain: str, code_hash: str) -> bool:
    return secure_compare(hash_otp_code(code_plain), code_hash)


def otp_expires_at():
    return now_utc() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)


def resend_not_before():
    return now_utc() + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)


def is_expired(dt) -> bool:
    return dt < now_utc()


def attempts_exceeded(attempts: int) -> bool:
    return attempts >= settings.OTP_MAX_ATTEMPTS
