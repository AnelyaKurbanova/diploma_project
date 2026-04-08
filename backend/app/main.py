from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.settings import settings
from app.core.logging import (
    setup_logging,
    generate_request_id,
    set_request_context,
    clear_request_context,
)
from app.core.errors import AppError
from app.core.metrics import instrumentator
from app.core.tracing import setup_tracing
from app.routers import api_router

from app.data.cache.redis_backend import init_redis_cache, close_redis_cache

setup_logging()
logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Generates request_id, logs every HTTP request/response, injects X-Request-ID header."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or generate_request_id()

        # Extract authenticated user id if available (set by auth layer later in stack).
        # We pre-set None here; downstream code can call set_request_context again to add user_id.
        set_request_context(request_id=request_id)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
            logger.error(
                "Request failed with unhandled exception",
                extra={
                    "http_method": request.method,
                    "http_path": request.url.path,
                    "duration_ms": duration_ms,
                },
                exc_info=True,
            )
            raise
        finally:
            clear_request_context()

        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        status_code = response.status_code
        level = logging.WARNING if status_code >= 500 else logging.DEBUG
        logger.log(
            level,
            "HTTP %s %s %s %.1fms",
            request.method,
            request.url.path,
            status_code,
            duration_ms,
            extra={
                "http_method": request.method,
                "http_path": request.url.path,
                "http_status": status_code,
                "duration_ms": duration_ms,
            },
        )

        response.headers["X-Request-ID"] = request_id
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-load embedding model in a thread so first request isn't blocked
    try:
        from app.modules.knowledge.application.embedding import preload_model
        await asyncio.to_thread(preload_model)
        logger.info("Embedding model pre-loaded")
    except Exception as exc:
        logger.warning("Could not pre-load embedding model: %s", exc)
    await init_redis_cache(settings.REDIS_URL)
    yield
    await close_redis_cache()


app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG, lifespan=lifespan)

# --- OpenTelemetry (no-op when OTEL_EXPORTER_OTLP_ENDPOINT is not set) ---
setup_tracing(app)

# --- Prometheus HTTP metrics ---
instrumentator.instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

# --- Static ---
static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)

# Middleware stack (applied outermost-first in Starlette):
# 1. RequestLogging  – generate request_id, log access
# 2. Session         – OAuth state
# 3. CORS            – Cross-Origin policy
app.add_middleware(RequestLoggingMiddleware)

# --- OAuth session (required for Authlib / request.session) ---
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
    same_site="lax",
    https_only=settings.COOKIE_SECURE,  # True in prod (https)
    max_age=600,
)

# --- CORS (single middleware) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://orkenai.app",
        "https://www.orkenai.app",
        "https://orenaitest.app",
        "https://www.orenaitest.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.105:3000",
        "http://192.168.33.90:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

# --- Exception handlers ---
@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError):
    payload = exc.payload()
    return JSONResponse(
        status_code=exc.http_status,
        content={"error": payload.error, "message": payload.message},
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "Unhandled exception",
        exc_info=exc,
        extra={
            "http_method": request.method,
            "http_path": request.url.path,
        },
    )
    return JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "message": "Internal server error"},
    )

# --- Routes ---
app.include_router(api_router)

# --- Static mount ---
app.mount("/static", StaticFiles(directory=static_dir), name="static")
