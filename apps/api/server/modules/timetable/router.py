from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from server.core.database import get_session
from server.modules.timetable.models import Lesson

router = APIRouter(prefix="/timetable", tags=["timetable"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/{class_id}", response_model=list[Lesson])
async def get_timetable(class_id: int, session: SessionDep) -> list[Lesson]:
    lessons = session.exec(select(Lesson).where(Lesson.class_id == class_id)).all()
    return list(lessons)
