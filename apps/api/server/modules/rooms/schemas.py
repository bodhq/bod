"""Explicit request/response DTOs; ORM tables never serve as inputs."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field, StrictBool, StrictInt

from server.core.domain.schemas import DomainInput, DomainRead


class RoomTypesCreate(DomainInput):
    code: str = Field(default=..., max_length=50, min_length=1)
    name: str = Field(default=..., max_length=100, min_length=1)


class RoomTypesPatch(DomainInput):
    name: str | None = Field(default=None, max_length=100, min_length=1)


class RoomTypesRead(DomainRead):
    code: str
    name: str


class RoomsCreate(DomainInput):
    code: str = Field(default=..., max_length=30, min_length=1)
    name: str | None = Field(default=None, max_length=100)
    room_type_code: str = Field(default=..., max_length=50, min_length=1)
    capacity: StrictInt = Field(default=...)
    is_active: StrictBool = Field(default=True)


class RoomsPatch(DomainInput):
    code: str | None = Field(default=None, max_length=30, min_length=1)
    name: str | None = Field(default=None, max_length=100)
    room_type_code: str | None = Field(default=None, max_length=50, min_length=1)
    capacity: StrictInt | None = Field(default=None)
    is_active: StrictBool | None = Field(default=None)


class RoomsRead(DomainRead):
    id: UUID
    code: str
    name: str | None
    room_type_code: str
    capacity: StrictInt
    is_active: StrictBool


class GroupHomeRoomsCreate(DomainInput):
    group_id: UUID = Field(default=...)
    room_id: UUID = Field(default=...)


class GroupHomeRoomsPatch(DomainInput):
    room_id: UUID | None = Field(default=None)


class GroupHomeRoomsRead(DomainRead):
    group_id: UUID
    room_id: UUID


class RoomDistanceModelsCreate(DomainInput):
    name: str = Field(default=..., max_length=100, min_length=1)
    description: str | None = Field(default=None)


class RoomDistanceModelsPatch(DomainInput):
    name: str | None = Field(default=None, max_length=100, min_length=1)
    description: str | None = Field(default=None)


class RoomDistanceModelsRead(DomainRead):
    id: UUID
    name: str
    description: str | None
    created_at: datetime
    frozen_at: datetime | None


class RoomConnectionsCreate(DomainInput):
    distance_model_id: UUID = Field(default=...)
    from_room_id: UUID = Field(default=...)
    to_room_id: UUID = Field(default=...)
    relative_cost: Decimal = Field(default=...)


class RoomConnectionsPatch(DomainInput):
    relative_cost: Decimal | None = Field(default=None)


class RoomConnectionsRead(DomainRead):
    distance_model_id: UUID
    from_room_id: UUID
    to_room_id: UUID
    relative_cost: Decimal


class RoomUnavailabilityCreate(DomainInput):
    room_id: UUID = Field(default=...)
    starts_at: datetime = Field(default=...)
    ends_at: datetime = Field(default=...)
    reason: str | None = Field(default=None)


class RoomUnavailabilityPatch(DomainInput):
    room_id: UUID | None = Field(default=None)
    starts_at: datetime | None = Field(default=None)
    ends_at: datetime | None = Field(default=None)
    reason: str | None = Field(default=None)


class RoomUnavailabilityRead(DomainRead):
    id: UUID
    room_id: UUID
    starts_at: datetime
    ends_at: datetime
    reason: str | None
