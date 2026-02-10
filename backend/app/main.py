from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.settings import settings
from app.core.logging import setup_logging
from app.core.errors import AppError
from app.routers import api_router

setup_logging()

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

# CORS (для фронта и cookies)
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

# Обязательно для Google OAuth (request.session)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
    same_site="lax",
    https_only=settings.COOKIE_SECURE,  # false локально, true в prod
    max_age=600,
)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError):
    payload = exc.payload()
    return JSONResponse(
        status_code=exc.http_status,
        content={"error": payload.error, "message": payload.message},
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, __: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "message": "Internal server error"},
    )

app.include_router(api_router)
