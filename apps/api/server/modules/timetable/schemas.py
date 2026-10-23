"""
VRSTVA 2: DTO SCHÉMATA (Pydantic)
Definuje striktní formát JSON dat, která vstupují do API nebo z něj vystupují.
Slouží jako bezpečnostní filtr (zabraňuje úniku citlivých sloupců z databáze)
a automaticky generuje TypeScript klienty přes OpenAPI.
"""

from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from server.core.validation import ClockTime, PositiveDatabaseId, ProfileName


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
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "description": "Vyučovací hodina v jednom dni. "
            "end_time musí být po start_time.",
        },
    )
    class_id: Annotated[PositiveDatabaseId, Field(strict=True)]
    subject: Annotated[ProfileName, StringConstraints(strip_whitespace=True)]
    teacher_id: Annotated[PositiveDatabaseId, Field(strict=True)]
    room: Annotated[ProfileName, StringConstraints(strip_whitespace=True)]
    day: int = Field(ge=1, le=7, strict=True, description="1 = pondělí, 7 = neděle.")
    start_time: ClockTime
    end_time: ClockTime

    @model_validator(mode="after")
    def validate_time_range(self) -> Self:
        if self.end_time <= self.start_time:
            raise ValueError("end_time musí být po start_time ve stejném dni.")
        return self
