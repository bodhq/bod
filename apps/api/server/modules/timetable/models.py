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
