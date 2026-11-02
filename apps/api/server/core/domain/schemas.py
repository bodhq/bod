from datetime import datetime, time
from typing import Self

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


class DomainInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def validate_values(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            raise ValueError("Text nesmí být prázdný.")
        if isinstance(value, datetime) and value.tzinfo is None:
            raise ValueError("Čas musí obsahovat časové pásmo.")
        return value

    @model_validator(mode="after")
    def validate_instants(self) -> Self:
        for value in self.__dict__.values():
            if isinstance(value, datetime) and value.tzinfo is None:
                raise ValueError("Čas musí obsahovat časové pásmo.")
            if isinstance(value, time) and value.tzinfo is not None:
                raise ValueError("Zvonění používá místní čas bez časového pásma.")
        return self


class DomainRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
