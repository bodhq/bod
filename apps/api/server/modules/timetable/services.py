"""
VRSTVA 4: BYZNYS LOGIKA (Services)
Funguje jako "dirigent". Přebírá požadavky z HTTP routeru, aplikuje na ně
čistou byznys logiku a k získání či uložení dat volá vrstvu Repository.
Tato izolace zajišťuje perfektní a jednoduchou testovatelnost.
"""
from sqlmodel import Session

from server.core.exceptions import NotFoundException
from server.modules.timetable.models import Lesson
from server.modules.timetable.repository import TimetableRepository


class TimetableService:
    def __init__(self, session: Session):
        self.repository = TimetableRepository(session)

    def get_class_timetable(self, class_id: int) -> list[Lesson]:
        lessons = self.repository.get_lessons_by_class(class_id)
        if not lessons:
            raise NotFoundException("Rozvrh nebyl nalezen.")
        return lessons
