from fastapi import APIRouter
from app.modules.projects.api.router import router as projects_router

api_router = APIRouter()
api_router.include_router(projects_router)
