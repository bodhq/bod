from fastapi import APIRouter

from server.core.auth.router import router as auth_router
from server.modules.timetable.router import router as timetable_router

api_router = APIRouter()

api_router.include_router(timetable_router)
api_router.include_router(auth_router)
