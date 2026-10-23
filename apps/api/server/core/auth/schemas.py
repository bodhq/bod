from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from server.core.validation import Username


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: Username
    password: str = Field(
        min_length=1,
        max_length=1024,
        repr=False,
        json_schema_extra={"format": "password", "writeOnly": True},
    )


class AuthSessionPublic(BaseModel):
    """Bezpečná data relace, která smí vidět přihlášený uživatel."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    active_role_code: str | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
