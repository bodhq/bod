"""
VRSTVA 3: DATA ACCESS LAYER (Repository Pattern)
Toto je absolutně jediné místo v modulu, které smí komunikovat s databází
a provádět SQL dotazy (přes `session.exec(select(...))`).
Zcela odstiňuje byznys logiku a HTTP vrstvu od implementace databáze.
"""
from sqlmodel import Session, select

from server.modules.timetable.models import Lesson


class TimetableRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_lessons_by_class(self, class_id: int) -> list[Lesson]:
        lessons = self.session.exec(
            select(Lesson).where(Lesson.class_id == class_id)
        ).all()
        return list(lessons)
