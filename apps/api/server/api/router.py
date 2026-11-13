from fastapi import APIRouter

from server.core.access.router import admin_router, profile_router
from server.core.auth.router import router as auth_router
from server.core.users.avatar_router import router as avatar_router
from server.modules.classbook.actions import router as classbook_actions
from server.modules.classbook.router import router as classbook_router
from server.modules.rooms.router import router as rooms_router
from server.modules.school.actions import router as school_actions
from server.modules.school.router import router as school_router
from server.modules.timetable.actions import router as timetable_actions
from server.modules.timetable.management import router as timetable_management
from server.modules.timetable.router import router as timetable_router

api_router = APIRouter()

api_router.include_router(school_actions)
api_router.include_router(school_router)
api_router.include_router(rooms_router)
api_router.include_router(timetable_management)
api_router.include_router(timetable_actions)
api_router.include_router(timetable_router)
api_router.include_router(classbook_actions)
api_router.include_router(classbook_router)
api_router.include_router(auth_router)
api_router.include_router(admin_router)
api_router.include_router(profile_router)
api_router.include_router(avatar_router)
