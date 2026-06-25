"""
VRSTVA 1: DATABÁZOVÉ MODELY (SQLModel)
Definuje výhradně strukturu tabulek v PostgreSQL. 
Tato vrstva nesmí obsahovat byznys logiku ani validaci HTTP požadavků.
Při startu aplikace (Auto-Init) se z těchto tříd automaticky vytvoří databázové tabulky.
"""
from sqlmodel import Field, SQLModel


class Lesson(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    class_id: int = Field(..., ge=1)
    subject: str
    teacher_id: int
    room: str
    day: int = Field(..., ge=1, le=7)
    start_time: str
    end_time: str
