from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

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


DEFAULT_ERROR_MESSAGES = {
    status.HTTP_400_BAD_REQUEST: "Запрос составлен неверно. Проверьте данные и попробуйте ещё раз.",
    status.HTTP_401_UNAUTHORIZED: "Нужно войти в аккаунт, чтобы продолжить.",
    status.HTTP_403_FORBIDDEN: "У вас нет доступа к этому действию.",
    status.HTTP_404_NOT_FOUND: "Запрашиваемый ресурс не найден.",
    status.HTTP_409_CONFLICT: "Действие конфликтует с текущим состоянием данных.",
    status.HTTP_422_UNPROCESSABLE_ENTITY: "Проверьте заполнение полей и попробуйте ещё раз.",
    status.HTTP_429_TOO_MANY_REQUESTS: "Слишком много запросов. Попробуйте немного позже.",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "На сервере произошла ошибка. Попробуйте позже.",
}


def _request_id(request: Request) -> str | None:
    value = getattr(request.state, "request_id", None)
    if isinstance(value, str) and value:
        return value
    header_value = request.headers.get("X-Request-ID")
    return header_value or None


def _error_response(
    request: Request,
    *,
    status_code: int,
    error: str,
    message: str | None = None,
    details: list[dict[str, Any]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    content: dict[str, Any] = {
        "error": error,
        "message": message or DEFAULT_ERROR_MESSAGES.get(status_code, "Не удалось выполнить запрос."),
    }
    request_id = _request_id(request)
    if request_id:
        content["request_id"] = request_id
    if details:
        content["details"] = details
    return JSONResponse(status_code=status_code, content=content, headers=headers)


def _validation_details(exc: RequestValidationError) -> list[dict[str, Any]]:
    details: list[dict[str, Any]] = []
    for item in exc.errors():
        loc = item.get("loc") or ()
        field = ".".join(str(part) for part in loc if part != "body") or "request"
        details.append(
            {
                "field": field,
                "message": item.get("msg", "Некорректное значение"),
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
        status_code=exc.http_status,
        error=payload.error,
        message=payload.message,
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return _error_response(
        request,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        error="validation_error",
        details=_validation_details(exc),
    )


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else None
    if detail in {"Not Found", "Method Not Allowed", "Not authenticated"}:
        detail = None
    error = "http_error"
    if exc.status_code == status.HTTP_401_UNAUTHORIZED:
        error = "unauthorized"
    elif exc.status_code == status.HTTP_403_FORBIDDEN:
        error = "forbidden"
    elif exc.status_code == status.HTTP_404_NOT_FOUND:
        error = "not_found"
    elif exc.status_code == status.HTTP_405_METHOD_NOT_ALLOWED:
        error = "method_not_allowed"
    return _error_response(
        request,
        status_code=exc.status_code,
        error=error,
        message=detail,
        headers=exc.headers,
    )


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request: Request, exc: SQLAlchemyError):
    logger.exception(
        "Database error",
        exc_info=exc,
        extra={
            "http_method": request.method,
            "http_path": request.url.path,
        },
    )
    return _error_response(
        request,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        error="database_error",
        message="Не удалось выполнить операцию с данными. Попробуйте позже.",
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
        status_code=500,
        error="internal_server_error",
    )

                
app.include_router(api_router)

                      
app.mount("/static", StaticFiles(directory=static_dir), name="static")
