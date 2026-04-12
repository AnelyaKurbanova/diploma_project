"""OpenTelemetry tracing initialisation.

Call ``setup_tracing(app)`` once at application startup (after the FastAPI
``app`` object is created).  When ``OTEL_EXPORTER_OTLP_ENDPOINT`` is not
set the tracer runs in no-op mode so the application still starts normally
in local dev without a Tempo/Jaeger sidecar.

The trace_id from the active span is automatically injected into log records
via ``_OtelLoggingFilter``, which hooks into the existing root logger.
"""
from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI

logger = logging.getLogger(__name__)


def _try_setup_otel(app: "FastAPI") -> bool:
    """Returns True if OTEL was fully configured, False if skipped."""
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    service_name = os.getenv("OTEL_SERVICE_NAME", "fastapi-backend")

    if not endpoint:
        logger.info("OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing disabled")
        return False

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        from opentelemetry.instrumentation.redis import RedisInstrumentor

        resource = Resource.create({SERVICE_NAME: service_name})
        provider = TracerProvider(resource=resource)
        exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)

        FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
        SQLAlchemyInstrumentor().instrument(enable_commenter=True, commenter_options={})
        RedisInstrumentor().instrument()

        _attach_trace_id_filter()
        logger.info("OpenTelemetry tracing enabled → %s (service=%s)", endpoint, service_name)
        return True

    except Exception as exc:                
        logger.warning("Failed to initialise OpenTelemetry tracing: %s", exc)
        return False


def _attach_trace_id_filter() -> None:
    """Adds a log filter that injects the current OTEL trace_id into records."""

    try:
        from opentelemetry import trace as otel_trace

        class _OtelLoggingFilter(logging.Filter):
            def filter(self, record: logging.LogRecord) -> bool:
                span = otel_trace.get_current_span()
                ctx = span.get_span_context()
                if ctx and ctx.is_valid:
                    record.trace_id = format(ctx.trace_id, "032x")                              
                    record.span_id = format(ctx.span_id, "016x")                              
                else:
                    record.trace_id = None                              
                    record.span_id = None                              
                return True

        logging.getLogger().addFilter(_OtelLoggingFilter())
    except Exception as exc:                
        logger.debug("Could not attach OTEL logging filter: %s", exc)


def setup_tracing(app: "FastAPI") -> None:
    _try_setup_otel(app)
