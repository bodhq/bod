from typing import Any, ClassVar
from uuid import UUID

from sqlmodel import Field, SQLModel


class Role(SQLModel, table=True):
    # SQLModel deklaruje tento ORM atribut také jako declared_attr deskriptor.
    __tablename__: ClassVar[Any] = "roles"
    code: str = Field(primary_key=True, max_length=64)
    name: str = Field(max_length=100)
    description: str | None = None


class Permission(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "permissions"
    code: str = Field(primary_key=True, max_length=100)
    description: str


class UserRole(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "user_roles"
    user_id: UUID = Field(primary_key=True, foreign_key="users.id", ondelete="CASCADE")
    role_code: str = Field(primary_key=True, foreign_key="roles.code", index=True)


class RolePermission(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "role_permissions"
    role_code: str = Field(
        primary_key=True, foreign_key="roles.code", ondelete="CASCADE"
    )
    permission_code: str = Field(
        primary_key=True, foreign_key="permissions.code", index=True
    )
