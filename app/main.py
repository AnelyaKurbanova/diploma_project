from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.settings import settings
from app.core.logging import setup_logging
from app.core.errors import AppError
from app.routers import api_router

setup_logging()

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

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

app.include_router(api_router)
