from __future__ import annotations
from fastapi import Request
from app.core.errors import Unauthorized
from app.modules.auth.security.cookies import CSRF_COOKIE
from app.modules.auth.security.tokens import hash_value, secure_compare


def validate_double_submit(request: Request) -> str:
    csrf_cookie = request.cookies.get(CSRF_COOKIE)
    csrf_header = request.headers.get("X-CSRF-Token")
    if not csrf_cookie or not csrf_header:
        raise Unauthorized("CSRF validation failed")
    if not secure_compare(csrf_cookie, csrf_header):
        raise Unauthorized("CSRF validation failed")
    return csrf_header


def validate_csrf_hash(csrf_plain: str, csrf_hash_from_db: str):
    if not secure_compare(hash_value(csrf_plain), csrf_hash_from_db):
        raise Unauthorized("CSRF validation failed")
