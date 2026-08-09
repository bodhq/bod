from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AuthSession(SQLModel, table=True):
    __tablename__ = "auth_sessions"

    # Interní ID řádku v databázi.
    id: UUID = Field(default_factory=uuid4, primary_key=True)

    # Hash tajného tokenu z cookie — ne samotný token.
    token_hash: str = Field(index=True, unique=True)

    user_id: UUID = Field(foreign_key="users.id", index=True)

    # Sliding expiration pracuje s tímto časem.
    expires_at: datetime = Field(index=True)

    created_at: datetime = Field(default_factory=utcnow)
    last_seen_at: datetime = Field(default_factory=utcnow)