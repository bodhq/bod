from enum import StrEnum
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class Role(StrEnum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True)

    # Pro login normalizuj na lowercase.
    email: str = Field(index=True, unique=True)

    # Nikdy neukládej původní heslo.
    hashed_password: str

    role: Role = Field(default=Role.STUDENT)
    is_active: bool = Field(default=True)