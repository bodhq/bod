from fastapi import APIRouter

from server.core.access.router import admin_router, profile_router
from server.core.auth.router import router as auth_router
from server.core.users.avatar_router import router as avatar_router
from server.modules.timetable.router import router as timetable_router

api_router = APIRouter()

api_router.include_router(timetable_router)
api_router.include_router(auth_router)
api_router.include_router(admin_router)
api_router.include_router(profile_router)
api_router.include_router(avatar_router)
