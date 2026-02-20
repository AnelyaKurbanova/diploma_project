from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
import logging
from pathlib import Path

from app.settings import settings
from app.core.logging import setup_logging
from app.core.errors import AppError
from app.routers import api_router

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.APP_NAME, debug=False, root_path="/api")
static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)


def _cors_headers_for_request(request: Request) -> dict[str, str]:
    origin = request.headers.get("origin")
    if origin and origin in settings.FRONTEND_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return {}
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
    same_site="lax",
    https_only=settings.COOKIE_SECURE,  
    max_age=600,
)

# CORS должен быть outermost, поэтому добавляем после остальных middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_ORIGINS,
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
    return JSONResponse(
        status_code=exc.http_status,
        content={"error": payload.error, "message": payload.message},
        headers=_cors_headers_for_request(request),
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": str(exc) if settings.DEBUG else "Internal server error",
        },
        headers=_cors_headers_for_request(request),)
async def unhandled_exception_handler(_: Request, __: Exception):
    from app.core.i18n import tr

    return JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "message": tr("internal_server_error")},
    )

app.include_router(api_router)
app.mount("/static", StaticFiles(directory=static_dir), name="static")
