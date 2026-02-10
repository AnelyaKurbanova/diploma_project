from fastapi import APIRouter

from app.modules.catalog.api.router import router as catalog_router
from app.modules.lessons.api.router import router as lessons_router
from app.modules.projects.api.router import router as projects_router
from app.modules.problems.api.router import router as problems_router
from app.modules.submissions.api.router import router as submissions_router

from app.modules.auth.api.router import router as auth_router

api_router = APIRouter()
api_router.include_router(catalog_router)
api_router.include_router(lessons_router)
api_router.include_router(problems_router)
api_router.include_router(submissions_router)
api_router.include_router(projects_router)
api_router.include_router(auth_router)


