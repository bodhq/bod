from datetime import datetime
from typing import Annotated, Any, Self
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StrictBool,
    StringConstraints,
    field_validator,
    model_validator,
)
from pydantic.json_schema import SkipJsonSchema

from server.core.validation import (
    PermissionCode,
    PhoneNumber,
    ProfileName,
    RoleCode,
    Username,
)


def unique_codes(values: list[str]) -> list[str]:
    if len(values) != len(set(values)):
        raise ValueError("Kódy se nesmějí opakovat.")
    return values


RoleCodes = Annotated[
    list[RoleCode],
    Field(max_length=20, json_schema_extra={"uniqueItems": True}),
    AfterValidator(unique_codes),
]
PermissionCodes = Annotated[
    list[PermissionCode],
    Field(max_length=100, json_schema_extra={"uniqueItems": True}),
    AfterValidator(unique_codes),
]
ADMIN_ROLE_RULE: dict[str, Any] = {
    "allOf": [
        {
            "if": {
                "required": ["role_codes"],
                "properties": {"role_codes": {"contains": {"const": "admin"}}},
            },
            "then": {"properties": {"role_codes": {"maxItems": 1}}},
        }
    ]
}


def omit_default(schema: dict[str, Any]) -> None:
    # Vynechané řídicí pole PATCH znamená beze změny; explicitní null je chyba.
    schema.pop("default", None)


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ProfileFields(InputModel):
    first_name: ProfileName | None = Field(
        default=None, description="Jméno; null vymaže údaj."
    )
    last_name: ProfileName | None = Field(
        default=None, description="Příjmení; null vymaže údaj."
    )
    display_name: ProfileName | None = Field(
        default=None, description="Zobrazované jméno."
    )
    email: Annotated[EmailStr, Field(max_length=254)] | None = None
    phone: PhoneNumber | None = Field(default=None, examples=["+420 123 456 789"])

    @field_validator(
        "first_name", "last_name", "display_name", "email", "phone", mode="before"
    )
    @classmethod
    def normalize_profile(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value


class ProfilePatch(ProfileFields):
    model_config = ConfigDict(extra="forbid", json_schema_extra={"minProperties": 1})

    @model_validator(mode="after")
    def require_change(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Pošli alespoň jedno pole k úpravě.")
        return self


class UserCreate(ProfileFields):
    model_config = ConfigDict(extra="forbid", json_schema_extra=ADMIN_ROLE_RULE)
    username: Username | None = Field(
        default=None,
        description="Normalizuje se na malá písmena. "
        "Vynechání nebo null vygeneruje jméno.",
    )
    role_codes: RoleCodes = Field(
        default_factory=list, description="Přidělené role. Admin musí být samostatně."
    )


class UserPatch(ProfilePatch):
    model_config = ConfigDict(
        extra="forbid", json_schema_extra={"minProperties": 1, **ADMIN_ROLE_RULE}
    )
    username: Username | SkipJsonSchema[None] = Field(
        default=None,
        json_schema_extra=omit_default,
        description="Vynechání ponechá jméno; null není povolené.",
    )
    is_active: StrictBool | SkipJsonSchema[None] = Field(
        default=None,
        json_schema_extra=omit_default,
        description="Pouze JSON true/false; null není povolené.",
    )
    role_codes: RoleCodes | SkipJsonSchema[None] = Field(
        default=None,
        json_schema_extra=omit_default,
        description="Nahradí všechny role; [] odebere všechny. Null není povolené.",
    )

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


class BatchCreate(InputModel):
    users: list[UserCreate] = Field(min_length=1, max_length=100)


class PasswordChange(InputModel):
    current_password: str = Field(
        min_length=1,
        max_length=1024,
        repr=False,
        json_schema_extra={"format": "password", "writeOnly": True},
    )
    new_password: str = Field(
        min_length=12,
        max_length=128,
        pattern=r"\S",
        repr=False,
        json_schema_extra={"format": "password", "writeOnly": True},
        description="12–128 znaků, alespoň jeden nebílý znak. "
        "Musí se lišit od současného hesla. Hesla se neořezávají.",
    )


class RoleSwitch(InputModel):
    role_code: RoleCode


class RoleWrite(InputModel):
    name: Annotated[ProfileName, StringConstraints(strip_whitespace=True)]
    description: str | None = Field(
        default=None, max_length=4000, pattern=r"^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f]*$"
    )
    permission_codes: PermissionCodes = Field(
        default_factory=list,
        description="Existující kódy z katalogu oprávnění; seznam nahradí celou sadu.",
    )

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value


class RoleCreate(RoleWrite):
    code: RoleCode


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
