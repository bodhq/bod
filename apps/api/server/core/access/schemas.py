from datetime import datetime
from typing import Any, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

USERNAME_PATTERN = r"^[a-z0-9][a-z0-9._-]{2,63}$"
CODE_PATTERN = r"^[a-z][a-z0-9._-]{1,63}$"


class ProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    display_name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(
        default=None, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    )
    phone: str | None = Field(default=None, max_length=32)

    @field_validator(
        "first_name", "last_name", "display_name", "email", "phone", mode="before"
    )
    @classmethod
    def normalize_profile(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value


class UserCreate(ProfilePatch):
    username: str | None = Field(default=None, pattern=USERNAME_PATTERN)
    role_codes: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class UserPatch(ProfilePatch):
    username: str | None = Field(default=None, pattern=USERNAME_PATTERN)
    is_active: bool | None = None
    role_codes: list[str] | None = Field(default=None, max_length=20)

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @model_validator(mode="after")
    def reject_null_control_fields(self) -> Self:
        for field in ("username", "is_active", "role_codes"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} nesmí být null")
        return self


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    username: str
    is_active: bool
    must_change_password: bool
    first_name: str | None
    last_name: str | None
    display_name: str | None
    email: str | None
    phone: str | None
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime
    roles: list[str] = Field(default_factory=list)


class MeRead(UserRead):
    active_role: str | None = None
    permissions: list[str] = Field(default_factory=list)


class IssuedAccount(BaseModel):
    user: UserRead
    temporary_password: str


class BatchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    users: list[UserCreate] = Field(min_length=1, max_length=100)


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=12, max_length=128)


class RoleSwitch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role_code: str = Field(pattern=CODE_PATTERN)


class RoleWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    permission_codes: list[str] = Field(default_factory=list, max_length=100)


class RoleCreate(RoleWrite):
    code: str = Field(pattern=CODE_PATTERN)


class RoleRead(RoleWrite):
    code: str


class PermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    code: str
    description: str


class AuditEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    actor_user_id: UUID | None
    actor_role_code: str | None
    operation: str
    event_code: str
    entity_type: str
    entity_id: str | None
    before_data: dict[str, Any] | None
    after_data: dict[str, Any] | None
    created_at: datetime
