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


class BuildingsCreate(DomainInput):
    code: str = Field(max_length=30, min_length=1)
    name: str = Field(max_length=100, min_length=1)
    address: str | None = Field(default=None, max_length=1000)


class BuildingsPatch(DomainInput):
    code: str | None = Field(default=None, max_length=30, min_length=1)
    name: str | None = Field(default=None, max_length=100, min_length=1)
    address: str | None = Field(default=None, max_length=1000)


class BuildingsRead(DomainRead):
    id: UUID
    code: str
    name: str
    address: str | None


class BuildingFloorsCreate(DomainInput):
    building_id: UUID
    number: StrictInt = Field(ge=-2147483648, le=2147483647)
    name: str | None = Field(default=None, max_length=100)
    width: StrictInt = Field(default=1000, gt=0, le=2147483647)
    height: StrictInt = Field(default=1000, gt=0, le=2147483647)


class BuildingFloorsPatch(DomainInput):
    building_id: UUID | None = None
    number: StrictInt | None = Field(default=None, ge=-2147483648, le=2147483647)
    name: str | None = Field(default=None, max_length=100)
    width: StrictInt | None = Field(default=None, gt=0, le=2147483647)
    height: StrictInt | None = Field(default=None, gt=0, le=2147483647)


class BuildingFloorsRead(DomainRead):
    id: UUID
    building_id: UUID
    number: StrictInt
    name: str | None
    width: StrictInt
    height: StrictInt


class RoomLayoutInput(DomainInput):
    floor_id: UUID | None = None
    x: StrictInt | None = Field(default=None, ge=0, le=2147483647)
    y: StrictInt | None = Field(default=None, ge=0, le=2147483647)
    width: StrictInt | None = Field(default=None, gt=0, le=2147483647)
    height: StrictInt | None = Field(default=None, gt=0, le=2147483647)


class RoomsCreate(RoomLayoutInput):
    code: str = Field(default=..., max_length=30, min_length=1)
    name: str | None = Field(default=None, max_length=100)
    room_type_code: str = Field(default=..., max_length=50, min_length=1)
    capacity: StrictInt = Field(default=...)
    is_active: StrictBool = Field(default=True)


class RoomsPatch(RoomLayoutInput):
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
    floor_id: UUID | None
    x: StrictInt | None
    y: StrictInt | None
    width: StrictInt | None
    height: StrictInt | None


class BuildingFloorLayoutRead(BuildingFloorsRead):
    rooms: list[RoomsRead]


class BuildingLayoutRead(BuildingsRead):
    floors: list[BuildingFloorLayoutRead]


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
