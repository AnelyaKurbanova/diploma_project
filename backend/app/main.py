from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException
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

DEFAULT_ERROR_MESSAGES: dict[int, tuple[str, str]] = {
    status.HTTP_400_BAD_REQUEST: (
        "bad_request",
        "Некорректный запрос. Проверьте данные и попробуйте снова.",
    ),
    status.HTTP_401_UNAUTHORIZED: ("unauthorized", "Необходимо войти в аккаунт."),
    status.HTTP_403_FORBIDDEN: ("forbidden", "У вас нет доступа к этому действию."),
    status.HTTP_404_NOT_FOUND: ("not_found", "Запрошенные данные не найдены."),
    status.HTTP_405_METHOD_NOT_ALLOWED: (
        "method_not_allowed",
        "Этот способ запроса не поддерживается.",
    ),
    status.HTTP_409_CONFLICT: (
        "conflict",
        "Действие конфликтует с текущими данными.",
    ),
    status.HTTP_422_UNPROCESSABLE_CONTENT: (
        "validation_error",
        "Проверьте поля формы: часть данных заполнена некорректно.",
    ),
    status.HTTP_429_TOO_MANY_REQUESTS: (
        "too_many_requests",
        "Слишком много запросов. Попробуйте чуть позже.",
    ),
    status.HTTP_500_INTERNAL_SERVER_ERROR: (
        "internal_server_error",
        "Произошла внутренняя ошибка. Попробуйте ещё раз позже.",
    ),
}

DEFAULT_HTTP_DETAILS = {
    "Bad Request",
    "Unauthorized",
    "Forbidden",
    "Not Found",
    "Method Not Allowed",
    "Not authenticated",
}


def _request_id(request: Request) -> str | None:
    request_id = getattr(request.state, "request_id", None)
    return request_id if isinstance(request_id, str) else None


def _error_response(
    request: Request,
    status_code: int,
    *,
    code: str | None = None,
    message: str | None = None,
    details: Any | None = None,
) -> JSONResponse:
    fallback_code, fallback_message = DEFAULT_ERROR_MESSAGES.get(
        status_code,
        ("request_failed", "Запрос не выполнен. Попробуйте ещё раз."),
    )
    content: dict[str, Any] = {
        "error": code or fallback_code,
        "message": message or fallback_message,
    }

    if details is not None:
        content["details"] = details

    request_id = _request_id(request)
    if request_id:
        content["request_id"] = request_id

    return JSONResponse(status_code=status_code, content=jsonable_encoder(content))


def _validation_details(exc: RequestValidationError) -> list[dict[str, str]]:
    details: list[dict[str, str]] = []
    for error in exc.errors():
        raw_location = error.get("loc", ())
        location = raw_location if isinstance(raw_location, (list, tuple)) else (raw_location,)
        field = ".".join(
            str(part) for part in location if part not in {"body", "query", "path"}
        )
        details.append(
            {
                "field": field or "request",
                "message": str(error.get("msg") or "Некорректное значение"),
                "type": str(error.get("type") or "validation_error"),
            }
        )
    return details


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Generates request_id, logs every HTTP request/response, injects X-Request-ID header."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or generate_request_id()
        request.state.request_id = request_id

                                                                                        
                                                                                                  
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

                                                                           
setup_tracing(app)

                                 
instrumentator.instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

                
static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)

                                                          
                                                      
                                  
                                          
app.add_middleware(RequestLoggingMiddleware)

                                                                
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
    same_site="lax",
    https_only=settings.COOKIE_SECURE,                        
    max_age=600,
)

                                  
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://orkenai.app",
        "https://www.orkenai.app",
        "https://orenaitest.app",
        "https://www.orenaitest.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
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

                            
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    payload = exc.payload()
    return _error_response(
        request,
        exc.http_status,
        code=payload.error,
        message=payload.message,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.info(
        "Request validation failed",
        extra={
            "http_method": request.method,
            "http_path": request.url.path,
        },
    )
    return _error_response(
        request,
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        code="validation_error",
        details=_validation_details(exc),
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    fallback_code, fallback_message = DEFAULT_ERROR_MESSAGES.get(
        exc.status_code,
        ("http_error", "Запрос не выполнен. Попробуйте ещё раз."),
    )
    detail = exc.detail if isinstance(exc.detail, str) else None
    message = detail if detail and detail not in DEFAULT_HTTP_DETAILS else fallback_message

    return _error_response(
        request,
        exc.status_code,
        code=fallback_code,
        message=message,
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.exception(
        "Database exception",
        exc_info=exc,
        extra={
            "http_method": request.method,
            "http_path": request.url.path,
        },
    )
    return _error_response(
        request,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="database_error",
        message="Не удалось выполнить операцию с данными. Попробуйте ещё раз.",
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
    return _error_response(
        request,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="internal_server_error",
    )

                
app.include_router(api_router)

                      
app.mount("/static", StaticFiles(directory=static_dir), name="static")
