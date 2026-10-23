"""Sdílená pravidla HTTP vstupů; omezení se exportují do OpenAPI."""

from typing import Annotated

from pydantic import BeforeValidator, Field, StringConstraints

USERNAME_PATTERN = r"^[a-z0-9][a-z0-9._-]{2,63}$"
CODE_PATTERN = r"^[a-z][a-z0-9._-]{1,63}$"
PERMISSION_PATTERN = r"^[a-z][a-z0-9._-]{1,99}$"
SINGLE_LINE_PATTERN = r"^[^\x00-\x1f\x7f]*[^\s\x00-\x1f\x7f][^\x00-\x1f\x7f]*$"
PHONE_PATTERN = r"^\+?[0-9](?:[0-9 ()-]*[0-9])?$"
TIME_PATTERN = r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$"
AVATAR_FILENAME_PATTERN = r"^[0-9a-f]{32}\.(?:webp|png)$"
MAX_DATABASE_ID = 2_147_483_647


def normalize_username(value: object) -> object:
    return value.strip().lower() if isinstance(value, str) else value


Username = Annotated[
    str,
    StringConstraints(min_length=3, max_length=64, pattern=USERNAME_PATTERN),
    BeforeValidator(normalize_username),
]
RoleCode = Annotated[
    str, StringConstraints(min_length=2, max_length=64, pattern=CODE_PATTERN)
]
PermissionCode = Annotated[
    str, StringConstraints(min_length=2, max_length=100, pattern=PERMISSION_PATTERN)
]
ProfileName = Annotated[
    str, StringConstraints(min_length=1, max_length=100, pattern=SINGLE_LINE_PATTERN)
]
PhoneNumber = Annotated[
    str, StringConstraints(min_length=1, max_length=32, pattern=PHONE_PATTERN)
]
PositiveDatabaseId = Annotated[int, Field(ge=1, le=MAX_DATABASE_ID)]
ClockTime = Annotated[
    str, StringConstraints(min_length=5, max_length=5, pattern=TIME_PATTERN)
]
