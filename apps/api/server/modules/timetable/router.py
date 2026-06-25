"""
VRSTVA 5: HTTP ENDPOINTS (Router)
Příjímací pult pro frontend. Úkolem routeru je pouze nastavit API prefix,
identifikovat uživatele z JWT, zavolat vrstvu Services a vrácený výsledek
zabalit do Pydantic DTO (vrstva 2). Router nesmí znát ani SQL, ani byznys logiku.
"""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from server.core.database import get_session
from server.modules.timetable.schemas import LessonPublic
from server.modules.timetable.services import TimetableService

router = APIRouter(prefix="/timetable", tags=["timetable"])
SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/{class_id}", response_model=list[LessonPublic])
async def get_timetable(class_id: int, session: SessionDep) -> list[LessonPublic]:
    service = TimetableService(session)
    lessons = service.get_class_timetable(class_id)
    return [LessonPublic.model_validate(lesson) for lesson in lessons]
