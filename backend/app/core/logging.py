from __future__ import annotations

import logging
import uuid
from contextvars import ContextVar
from typing import Optional

from pythonjsonlogger import jsonlogger

# --- Context variables injected per-request ---
_request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
_user_id_var: ContextVar[Optional[str]] = ContextVar("user_id", default=None)


def set_request_context(request_id: str, user_id: Optional[str] = None) -> None:
    _request_id_var.set(request_id)
    _user_id_var.set(user_id)


def clear_request_context() -> None:
    _request_id_var.set(None)
    _user_id_var.set(None)


def get_request_id() -> Optional[str]:
    return _request_id_var.get()


def generate_request_id() -> str:
    return uuid.uuid4().hex


class _ContextInjectingFilter(logging.Filter):
    """Injects request_id, user_id (and trace/span placeholders) into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id_var.get()  # type: ignore[attr-defined]
        record.user_id = _user_id_var.get()  # type: ignore[attr-defined]
        # trace_id / span_id are set by the OTEL logging filter when tracing is on;
        # provide None defaults here so the formatter never raises KeyError.
        if not hasattr(record, "trace_id"):
            record.trace_id = None  # type: ignore[attr-defined]
        if not hasattr(record, "span_id"):
            record.span_id = None  # type: ignore[attr-defined]
        return True


def setup_logging() -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO)

    handler = logging.StreamHandler()
    handler.setFormatter(
        jsonlogger.JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s"
            " %(request_id)s %(user_id)s %(trace_id)s %(span_id)s",
            json_ensure_ascii=False,
        )
    )
    handler.addFilter(_ContextInjectingFilter())
    root.handlers = [handler]

    # Silence overly verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
