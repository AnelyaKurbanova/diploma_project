"""Prometheus metrics initialisation.

Exposes standard HTTP metrics via prometheus-fastapi-instrumentator and
adds a small set of application-level (business) counters that are used
across the codebase with `from app.core.metrics import <counter>`.
"""
from __future__ import annotations

from prometheus_client import Counter, Histogram
from prometheus_fastapi_instrumentator import Instrumentator

# ---------------------------------------------------------------------------
# Business-level counters
# ---------------------------------------------------------------------------

llm_requests_total = Counter(
    "llm_requests_total",
    "Total LLM API calls",
    ["model", "operation"],
)

llm_errors_total = Counter(
    "llm_errors_total",
    "Total failed LLM API calls",
    ["model", "operation"],
)

llm_tokens_total = Counter(
    "llm_tokens_total",
    "Total LLM tokens consumed",
    ["model", "type"],  # type: prompt | completion
)

auth_events_total = Counter(
    "auth_events_total",
    "Authentication events (login, register, logout, token-refresh, otp, ...)",
    ["event", "status"],  # status: success | failure
)

cache_operations_total = Counter(
    "cache_operations_total",
    "Redis cache hit/miss counts",
    ["operation", "result"],  # operation: get|set|delete; result: hit|miss|ok|error
)

video_jobs_total = Counter(
    "video_jobs_total",
    "Video-render job events",
    ["status"],  # submitted | completed | failed
)

http_request_duration_seconds = Histogram(
    "app_http_request_duration_seconds",
    "Application-level request duration histogram (labelled by path)",
    ["method", "path", "status"],
    buckets=(0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)


# ---------------------------------------------------------------------------
# Instrumentator (HTTP metrics auto-collected from FastAPI)
# ---------------------------------------------------------------------------

instrumentator = Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
    should_respect_env_var=False,
    excluded_handlers=["/health", "/metrics"],
)
