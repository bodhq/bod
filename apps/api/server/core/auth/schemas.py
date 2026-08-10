from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=64,
        pattern=r"^[a-zA-Z0-9_.]+$",
    )
    password: str = Field(min_length=1, max_length=1024)


class AuthSessionPublic(BaseModel):
    """Bezpečná data relace, která smí vidět přihlášený uživatel."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime