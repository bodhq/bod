"""
VRSTVA 2: DTO SCHÉMATA (Pydantic)
Definuje striktní formát JSON dat, která vstupují do API nebo z něj vystupují.
Slouží jako bezpečnostní filtr (zabraňuje úniku citlivých sloupců z databáze)
a automaticky generuje TypeScript klienty přes OpenAPI.
"""
from pydantic import BaseModel, ConfigDict


class LessonPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    class_id: int
    subject: str
    teacher_id: int
    room: str
    day: int
    start_time: str
    end_time: str


class LessonCreate(BaseModel):
    class_id: int
    subject: str
    teacher_id: int
    room: str
    day: int
    start_time: str
    end_time: str
