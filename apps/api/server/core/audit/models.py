from datetime import datetime
from typing import Any, ClassVar
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Column, DateTime, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from server.core.users.models import utcnow


class AuditEvent(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "audit_events"
    __table_args__ = (
        Index("ix_identity_audit_entity", "entity_type", "entity_id", "created_at"),
        Index("ix_identity_audit_actor", "actor_user_id", "created_at"),
        CheckConstraint("operation IN ('created', 'updated', 'deleted')"),
    )
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    actor_user_id: UUID | None = Field(default=None, foreign_key="users.id")
    actor_role_code: str | None = Field(default=None, max_length=64)
    operation: str = Field(max_length=16)
    event_code: str = Field(max_length=100)
    entity_type: str = Field(max_length=100)
    entity_id: str | None = Field(default=None, max_length=255)
    before_data: dict[str, Any] | None = Field(default=None, sa_column=Column(JSONB))
    after_data: dict[str, Any] | None = Field(default=None, sa_column=Column(JSONB))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
