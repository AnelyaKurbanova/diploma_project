from fastapi import APIRouter
from app.modules.projects.api.router import router as projects_router
from app.modules.auth.api.router import router as auth_router

api_router = APIRouter()
api_router.include_router(projects_router)
api_router.include_router(auth_router)


