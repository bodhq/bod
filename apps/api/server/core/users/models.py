from datetime import UTC, datetime
from typing import Any, ClassVar
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Column, DateTime
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(UTC)


class User(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "users"
    __table_args__ = (
        CheckConstraint(
            "username = lower(btrim(username)) AND length(username) BETWEEN 3 AND 64"
        ),
    )
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    username: str = Field(unique=True, index=True, max_length=64)
    hashed_password: str
    is_active: bool = True
    must_change_password: bool = True
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    display_name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=32)
    # Relativní URL autorizovaného API; samotný obrázek je na disku školy.
    avatar_url: str | None = Field(default=None, max_length=512)
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
