from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict


class JsonLogFormatter(logging.Formatter):
    """Simple JSON log formatter suitable for structured log ingestion."""

    def format(self, record: logging.LogRecord) -> str:  # type: ignore[override]
        log: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Attach standard extras if present
        for key in ("job_id", "routing_key"):
            value = getattr(record, key, None)
            if value is not None:
                log[key] = value

        if record.exc_info:
            log["exc_info"] = self.formatException(record.exc_info)

        return json.dumps(log, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    """Configure root logger with JSON output to stdout."""

    root = logging.getLogger()
    root.setLevel(level.upper())

    # Remove any pre-existing handlers (e.g., from defaultConfig)
    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonLogFormatter())
    root.addHandler(handler)

