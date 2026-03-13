from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.settings import settings
from app.core.logging import setup_logging
from app.core.errors import AppError
from app.routers import api_router

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

# --- Static ---
static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)

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
async def unhandled_exception_handler(_: Request, exc: Exception):
    logger.exception("Unhandled exception", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "message": "Internal server error"},
    )

# --- Routes ---
app.include_router(api_router)

# --- Static mount ---
app.mount("/static", StaticFiles(directory=static_dir), name="static")
