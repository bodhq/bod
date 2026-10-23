from datetime import datetime
from typing import Any, ClassVar
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKeyConstraint
from sqlmodel import Field, SQLModel

from server.core.users.models import utcnow


class AuthSession(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "auth_sessions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "active_role_code"],
            ["user_roles.user_id", "user_roles.role_code"],
            name="fk_auth_session_active_role",
        ),
    )
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    token_hash: str = Field(unique=True, max_length=64)
    active_role_code: str | None = Field(default=None, max_length=64)
    ip_address: str | None = Field(default=None, max_length=45)
    user_agent: str | None = Field(default=None, max_length=512)
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    last_seen_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    expires_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True)
    )
