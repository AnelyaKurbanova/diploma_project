from __future__ import annotations
from dataclasses import dataclass
from fastapi import status

@dataclass(frozen=True)
class ErrorPayload:
    error: str
    message: str

class AppError(Exception):
    code: str = "app_error"
    http_status: int = status.HTTP_400_BAD_REQUEST
    message: str = "Application error"

    def __init__(self, message: str | None = None):
        super().__init__(message or self.message)
        if message:
            self.message = message

    def payload(self) -> ErrorPayload:
        return ErrorPayload(error=self.code, message=self.message)

class NotFound(AppError):
    code = "not_found"
    http_status = status.HTTP_404_NOT_FOUND
    message = "Not found"

class Conflict(AppError):
    code = "conflict"
    http_status = status.HTTP_409_CONFLICT
    message = "Conflict"
