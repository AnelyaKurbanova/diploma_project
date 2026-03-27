"""Unit tests for auth/security helpers and primitives (OTP/CSRF/JWT/Cookies)."""

from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi import Response
from starlette.requests import Request

from app.core.errors import Unauthorized
from app.modules.auth.security.cookies import (
    clear_auth_cookies,
    refresh_cookie_max_age,
    set_auth_cookies,
)
from app.modules.auth.security.csrf import validate_csrf_hash, validate_double_submit
from app.modules.auth.security.otp import (
    attempts_exceeded,
    generate_otp_code,
    hash_otp_code,
    is_expired,
    now_utc,
    otp_expires_at,
    resend_not_before,
    verify_otp_code,
)
from app.modules.auth.security.tokens import (
    create_access_token,
    create_refresh_token,
    decode_token,
    gen_csrf,
    gen_otp,
    hash_value,
)
from app.settings import settings


def _make_request(*, csrf_cookie: str | None, csrf_header: str | None) -> Request:
    headers: list[tuple[bytes, bytes]] = []
    if csrf_cookie is not None:
        headers.append((b"cookie", f"csrf_token={csrf_cookie}".encode("utf-8")))
    if csrf_header is not None:
        headers.append((b"x-csrf-token", csrf_header.encode("utf-8")))

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/auth/refresh",
        "headers": headers,
    }
    return Request(scope)


class TestOtpSecurity:
    def test_generate_otp_code_format(self):
        code = generate_otp_code()
        assert len(code) == 6
        assert code.isdigit()

    def test_hash_and_verify_otp(self):
        code = "123456"
        code_hash = hash_otp_code(code)
        assert verify_otp_code("123456", code_hash) is True
        assert verify_otp_code("654321", code_hash) is False

    def test_otp_expires_at_in_future(self):
        now = now_utc()
        exp = otp_expires_at()
        delta = exp - now
        assert delta.total_seconds() > 0
        assert delta <= timedelta(minutes=settings.OTP_EXPIRE_MINUTES, seconds=1)

    def test_resend_not_before_in_future(self):
        now = now_utc()
        cooldown_until = resend_not_before()
        delta = cooldown_until - now
        assert delta.total_seconds() > 0
        assert delta <= timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS + 1)

    def test_is_expired(self):
        assert is_expired(now_utc() - timedelta(seconds=1)) is True
        assert is_expired(now_utc() + timedelta(seconds=1)) is False

    def test_attempts_exceeded_boundaries(self):
        limit = settings.OTP_MAX_ATTEMPTS
        assert attempts_exceeded(limit - 1) is False
        assert attempts_exceeded(limit) is True
        assert attempts_exceeded(limit + 1) is True


class TestCsrfSecurity:
    def test_validate_double_submit_success(self):
        request = _make_request(csrf_cookie="abc", csrf_header="abc")
        assert validate_double_submit(request) == "abc"

    def test_validate_double_submit_missing_cookie_or_header(self):
        request_no_cookie = _make_request(csrf_cookie=None, csrf_header="abc")
        request_no_header = _make_request(csrf_cookie="abc", csrf_header=None)

        with pytest.raises(Unauthorized):
            validate_double_submit(request_no_cookie)
        with pytest.raises(Unauthorized):
            validate_double_submit(request_no_header)

    def test_validate_double_submit_mismatch(self):
        request = _make_request(csrf_cookie="abc", csrf_header="xyz")
        with pytest.raises(Unauthorized):
            validate_double_submit(request)

    def test_validate_csrf_hash_success(self):
        csrf_plain = "csrf-plain"
        csrf_hash = hash_value(csrf_plain)
        validate_csrf_hash(csrf_plain, csrf_hash)

    def test_validate_csrf_hash_failure(self):
        with pytest.raises(Unauthorized):
            validate_csrf_hash("csrf-plain", "wrong-hash")


class TestTokenSecurity:
    def test_gen_otp_and_gen_csrf_shapes(self):
        otp = gen_otp()
        csrf = gen_csrf()
        assert len(otp) == 6 and otp.isdigit()
        assert len(csrf) >= 32

    def test_access_token_roundtrip(self):
        user_id = "user-123"
        token = create_access_token(user_id)
        payload = decode_token(token)
        assert payload["sub"] == user_id
        assert payload["type"] == "access"
        assert payload["iss"] == settings.JWT_ISSUER
        assert payload["aud"] == settings.JWT_AUDIENCE

    def test_refresh_token_roundtrip(self):
        user_id = "user-123"
        jti = "session-jti-1"
        token = create_refresh_token(user_id, jti)
        payload = decode_token(token)
        assert payload["sub"] == user_id
        assert payload["type"] == "refresh"
        assert payload["jti"] == jti

    def test_decode_token_invalid_returns_empty_dict(self):
        assert decode_token("not-a-real-token") == {}


class TestAuthCookies:
    def test_refresh_cookie_max_age(self):
        assert refresh_cookie_max_age() == settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

    def test_set_auth_cookies_sets_both_cookies(self):
        response = Response()
        set_auth_cookies(response, refresh_token="rtok", csrf_token="ctok")
        set_cookie_headers = response.headers.getlist("set-cookie")

        assert len(set_cookie_headers) == 2
        # Both cookies are set on Path=/ (client can use them across the app).
        assert any("refresh_token=rtok" in h and "Path=/" in h for h in set_cookie_headers)
        assert any("csrf_token=ctok" in h and "Path=/" in h for h in set_cookie_headers)

    def test_clear_auth_cookies_sets_delete_headers(self):
        response = Response()
        clear_auth_cookies(response)
        set_cookie_headers = response.headers.getlist("set-cookie")

        # Refresh cookie is deleted for both /auth and / paths (backward compatibility),
        # plus CSRF cookie is deleted for /.
        assert len(set_cookie_headers) == 3
        assert any("refresh_token=" in h and "Max-Age=0" in h and "Path=/auth" in h for h in set_cookie_headers)
        assert any("refresh_token=" in h and "Max-Age=0" in h and "Path=/" in h for h in set_cookie_headers)
        assert any("csrf_token=" in h and "Max-Age=0" in h and "Path=/" in h for h in set_cookie_headers)

