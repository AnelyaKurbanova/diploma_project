from __future__ import annotations

from dataclasses import dataclass

from fastapi import status

from app.core.i18n import tr


@dataclass(frozen=True)
class ErrorPayload:
    error: str
    message: str


class AppError(Exception):
    code: str = "app_error"
    http_status: int = status.HTTP_400_BAD_REQUEST
    _default_key: str = "app_error"

    def __init__(self, message: str | None = None):
        resolved = message or tr(self._default_key)
        super().__init__(resolved)
        self.message = resolved

    def payload(self) -> ErrorPayload:
        return ErrorPayload(error=self.code, message=self.message)


class NotFound(AppError):
    code = "not_found"
    http_status = status.HTTP_404_NOT_FOUND
    _default_key = "not_found"


class Conflict(AppError):
    code = "conflict"
    http_status = status.HTTP_409_CONFLICT
    _default_key = "conflict"


class BadRequest(AppError):
    code = "bad_request"
    http_status = status.HTTP_400_BAD_REQUEST
    _default_key = "bad_request"


class Unauthorized(AppError):
    code = "unauthorized"
    http_status = status.HTTP_401_UNAUTHORIZED
    _default_key = "unauthorized"


class Forbidden(AppError):
    code = "forbidden"
    http_status = status.HTTP_403_FORBIDDEN
    _default_key = "forbidden"


class TooManyRequests(AppError):
    code = "too_many_requests"
    http_status = status.HTTP_429_TOO_MANY_REQUESTS
    _default_key = "too_many_requests"
