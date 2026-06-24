from fastapi import APIRouter

from server.modules.timetable.router import router as timetable_router

api_router = APIRouter()

api_router.include_router(timetable_router)
