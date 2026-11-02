from server.core.domain.resource import Resource

from . import models, schemas

RESOURCES = [
    Resource(
        "room_types",
        models.RoomTypes,
        schemas.RoomTypesCreate,
        schemas.RoomTypesPatch,
        schemas.RoomTypesRead,
        "rooms.manage",
    ),
    Resource(
        "rooms",
        models.Rooms,
        schemas.RoomsCreate,
        schemas.RoomsPatch,
        schemas.RoomsRead,
        "rooms.manage",
    ),
    Resource(
        "group_home_rooms",
        models.GroupHomeRooms,
        schemas.GroupHomeRoomsCreate,
        schemas.GroupHomeRoomsPatch,
        schemas.GroupHomeRoomsRead,
        "rooms.manage",
    ),
    Resource(
        "room_distance_models",
        models.RoomDistanceModels,
        schemas.RoomDistanceModelsCreate,
        schemas.RoomDistanceModelsPatch,
        schemas.RoomDistanceModelsRead,
        "rooms.manage",
    ),
    Resource(
        "room_connections",
        models.RoomConnections,
        schemas.RoomConnectionsCreate,
        schemas.RoomConnectionsPatch,
        schemas.RoomConnectionsRead,
        "rooms.manage",
    ),
    Resource(
        "room_unavailability",
        models.RoomUnavailability,
        schemas.RoomUnavailabilityCreate,
        schemas.RoomUnavailabilityPatch,
        schemas.RoomUnavailabilityRead,
        "rooms.manage",
    ),
]
