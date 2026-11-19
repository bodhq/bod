"""ORM tables for the checked-in schema/bod.dbml."""

from datetime import datetime
from decimal import Decimal
from typing import Any, ClassVar
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlmodel import Field, SQLModel

from server.core.users.models import utcnow


class RoomTypes(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "room_types"
    __table_args__ = ()
    code: str = Field(sa_column=Column(String(50), nullable=False, primary_key=True))
    name: str = Field(sa_column=Column(String(100), nullable=False))


class Buildings(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "buildings"
    id: UUID = Field(
        default_factory=uuid4,
        sa_column=Column(
            Uuid,
            nullable=False,
            primary_key=True,
            server_default=text("gen_random_uuid()"),
        ),
    )
    code: str = Field(sa_column=Column(String(30), nullable=False, unique=True))
    name: str = Field(sa_column=Column(String(100), nullable=False))
    address: str | None = Field(default=None, sa_column=Column(Text, nullable=True))


class BuildingFloors(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "building_floors"
    __table_args__ = (
        ForeignKeyConstraint(["building_id"], ["buildings.id"]),
        UniqueConstraint("building_id", "number"),
        CheckConstraint(
            "width > 0 AND height > 0", name="building_floors_size_positive"
        ),
    )
    id: UUID = Field(
        default_factory=uuid4,
        sa_column=Column(
            Uuid,
            nullable=False,
            primary_key=True,
            server_default=text("gen_random_uuid()"),
        ),
    )
    building_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    number: int = Field(sa_column=Column(Integer, nullable=False))
    name: str | None = Field(default=None, sa_column=Column(String(100), nullable=True))
    width: int = Field(default=1000, sa_column=Column(Integer, nullable=False))
    height: int = Field(default=1000, sa_column=Column(Integer, nullable=False))


class Rooms(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "rooms"
    __table_args__ = (
        ForeignKeyConstraint(["room_type_code"], ["room_types.code"]),
        ForeignKeyConstraint(["floor_id"], ["building_floors.id"]),
        Index("ix_rooms_floor_id", "floor_id"),
        Index("ix_rooms_room_type_code_capacity", "room_type_code", "capacity"),
        CheckConstraint("capacity > 0", name="rooms_capacity_positive"),
        CheckConstraint(
            "(x IS NULL AND y IS NULL AND width IS NULL AND height IS NULL) OR "
            "(floor_id IS NOT NULL AND x IS NOT NULL AND y IS NOT NULL "
            "AND width IS NOT NULL AND height IS NOT NULL "
            "AND x >= 0 AND y >= 0 AND width > 0 AND height > 0)",
            name="rooms_layout_valid",
        ),
    )
    id: UUID = Field(
        default_factory=uuid4,
        sa_column=Column(
            Uuid,
            nullable=False,
            primary_key=True,
            server_default=text("gen_random_uuid()"),
        ),
    )
    code: str = Field(sa_column=Column(String(30), nullable=False, unique=True))
    name: str | None = Field(default=None, sa_column=Column(String(100), nullable=True))
    room_type_code: str = Field(sa_column=Column(String(50), nullable=False))
    capacity: int = Field(sa_column=Column(Integer, nullable=False))
    floor_id: UUID | None = Field(default=None, sa_column=Column(Uuid, nullable=True))
    x: int | None = Field(default=None, sa_column=Column(Integer, nullable=True))
    y: int | None = Field(default=None, sa_column=Column(Integer, nullable=True))
    width: int | None = Field(default=None, sa_column=Column(Integer, nullable=True))
    height: int | None = Field(default=None, sa_column=Column(Integer, nullable=True))
    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default=text("true")),
    )


class GroupHomeRooms(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "group_home_rooms"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["teaching_groups.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["room_id"], ["rooms.id"]),
        Index("ix_group_home_rooms_room_id", "room_id"),
    )
    group_id: UUID = Field(sa_column=Column(Uuid, nullable=False, primary_key=True))
    room_id: UUID = Field(sa_column=Column(Uuid, nullable=False))


class RoomDistanceModels(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "room_distance_models"
    __table_args__ = ()
    id: UUID = Field(
        default_factory=uuid4,
        sa_column=Column(
            Uuid,
            nullable=False,
            primary_key=True,
            server_default=text("gen_random_uuid()"),
        ),
    )
    name: str = Field(sa_column=Column(String(100), nullable=False))
    description: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )
    frozen_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class RoomConnections(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "room_connections"
    __table_args__ = (
        ForeignKeyConstraint(["distance_model_id"], ["room_distance_models.id"]),
        ForeignKeyConstraint(["from_room_id"], ["rooms.id"]),
        ForeignKeyConstraint(["to_room_id"], ["rooms.id"]),
        PrimaryKeyConstraint("distance_model_id", "from_room_id", "to_room_id"),
        CheckConstraint(
            "from_room_id <> to_room_id", name="room_connections_no_self_edge"
        ),
        CheckConstraint("relative_cost > 0", name="room_connections_cost_positive"),
    )
    distance_model_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    from_room_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    to_room_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    relative_cost: Decimal = Field(sa_column=Column(Numeric(10, 3), nullable=False))


class RoomUnavailability(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "room_unavailability"
    __table_args__ = (
        ForeignKeyConstraint(["room_id"], ["rooms.id"]),
        Index("ix_room_unavailability_room_id_starts_at", "room_id", "starts_at"),
        CheckConstraint(
            "starts_at < ends_at", name="room_unavailability_interval_valid"
        ),
    )
    id: UUID = Field(
        default_factory=uuid4,
        sa_column=Column(
            Uuid,
            nullable=False,
            primary_key=True,
            server_default=text("gen_random_uuid()"),
        ),
    )
    room_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    starts_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    ends_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    reason: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
