from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from server.core.auth.dependencies import (
    CurrentContextDep,
    SessionDep,
    mutation_guard,
    no_store,
)
from server.core.domain.router import ERROR_RESPONSES, Pagination

from . import schemas
from .domain_service import RoomsDomainService
from .resources import RESOURCES

router = APIRouter(
    prefix="/rooms",
    tags=["rooms"],
    dependencies=[Depends(mutation_guard), Depends(no_store)],
    responses=ERROR_RESPONSES,
)


@router.get("/room-types", response_model=list[schemas.RoomTypesRead])
def list_room_types(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_types")
    ).list(context, page.offset, page.limit)


@router.get("/room-types/{code}", response_model=schemas.RoomTypesRead)
def get_room_types(
    code: str, context: CurrentContextDep, session: SessionDep
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_types")
    ).get(context, {"code": code})


@router.post("/room-types", response_model=schemas.RoomTypesRead, status_code=201)
def create_room_types(
    payload: schemas.RoomTypesCreate, context: CurrentContextDep, session: SessionDep
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_types")
    ).create(context, payload)


@router.patch("/room-types/{code}", response_model=schemas.RoomTypesRead)
def patch_room_types(
    code: str,
    payload: schemas.RoomTypesPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_types")
    ).patch(context, {"code": code}, payload)


@router.delete("/room-types/{code}", status_code=204)
def delete_room_types(
    code: str, context: CurrentContextDep, session: SessionDep
) -> Response:
    RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_types")
    ).delete(context, {"code": code})
    return Response(status_code=204)


@router.get("", response_model=list[schemas.RoomsRead])
def list_rooms(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "rooms")
    ).list(context, page.offset, page.limit)


@router.post("", response_model=schemas.RoomsRead, status_code=201)
def create_rooms(
    payload: schemas.RoomsCreate, context: CurrentContextDep, session: SessionDep
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "rooms")
    ).create(context, payload)


@router.get("/group-home-rooms", response_model=list[schemas.GroupHomeRoomsRead])
def list_group_home_rooms(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "group_home_rooms")
    ).list(context, page.offset, page.limit)


@router.get("/group-home-rooms/{group_id}", response_model=schemas.GroupHomeRoomsRead)
def get_group_home_rooms(
    group_id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "group_home_rooms")
    ).get(context, {"group_id": group_id})


@router.post(
    "/group-home-rooms", response_model=schemas.GroupHomeRoomsRead, status_code=201
)
def create_group_home_rooms(
    payload: schemas.GroupHomeRoomsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "group_home_rooms")
    ).create(context, payload)


@router.patch("/group-home-rooms/{group_id}", response_model=schemas.GroupHomeRoomsRead)
def patch_group_home_rooms(
    group_id: UUID,
    payload: schemas.GroupHomeRoomsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "group_home_rooms")
    ).patch(context, {"group_id": group_id}, payload)


@router.delete("/group-home-rooms/{group_id}", status_code=204)
def delete_group_home_rooms(
    group_id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "group_home_rooms")
    ).delete(context, {"group_id": group_id})
    return Response(status_code=204)


@router.get(
    "/room-distance-models", response_model=list[schemas.RoomDistanceModelsRead]
)
def list_room_distance_models(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_distance_models")
    ).list(context, page.offset, page.limit)


@router.get("/room-distance-models/{id}", response_model=schemas.RoomDistanceModelsRead)
def get_room_distance_models(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_distance_models")
    ).get(context, {"id": id})


@router.post(
    "/room-distance-models",
    response_model=schemas.RoomDistanceModelsRead,
    status_code=201,
)
def create_room_distance_models(
    payload: schemas.RoomDistanceModelsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_distance_models")
    ).create(context, payload)


@router.patch(
    "/room-distance-models/{id}", response_model=schemas.RoomDistanceModelsRead
)
def patch_room_distance_models(
    id: UUID,
    payload: schemas.RoomDistanceModelsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_distance_models")
    ).patch(context, {"id": id}, payload)


@router.delete("/room-distance-models/{id}", status_code=204)
def delete_room_distance_models(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_distance_models")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/room-connections", response_model=list[schemas.RoomConnectionsRead])
def list_room_connections(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_connections")
    ).list(context, page.offset, page.limit)


@router.get(
    "/room-connections/{distance_model_id}/{from_room_id}/{to_room_id}",
    response_model=schemas.RoomConnectionsRead,
)
def get_room_connections(
    distance_model_id: UUID,
    from_room_id: UUID,
    to_room_id: UUID,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_connections")
    ).get(
        context,
        {
            "distance_model_id": distance_model_id,
            "from_room_id": from_room_id,
            "to_room_id": to_room_id,
        },
    )


@router.post(
    "/room-connections", response_model=schemas.RoomConnectionsRead, status_code=201
)
def create_room_connections(
    payload: schemas.RoomConnectionsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_connections")
    ).create(context, payload)


@router.patch(
    "/room-connections/{distance_model_id}/{from_room_id}/{to_room_id}",
    response_model=schemas.RoomConnectionsRead,
)
def patch_room_connections(
    distance_model_id: UUID,
    from_room_id: UUID,
    to_room_id: UUID,
    payload: schemas.RoomConnectionsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_connections")
    ).patch(
        context,
        {
            "distance_model_id": distance_model_id,
            "from_room_id": from_room_id,
            "to_room_id": to_room_id,
        },
        payload,
    )


@router.delete(
    "/room-connections/{distance_model_id}/{from_room_id}/{to_room_id}", status_code=204
)
def delete_room_connections(
    distance_model_id: UUID,
    from_room_id: UUID,
    to_room_id: UUID,
    context: CurrentContextDep,
    session: SessionDep,
) -> Response:
    RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_connections")
    ).delete(
        context,
        {
            "distance_model_id": distance_model_id,
            "from_room_id": from_room_id,
            "to_room_id": to_room_id,
        },
    )
    return Response(status_code=204)


@router.get("/room-unavailability", response_model=list[schemas.RoomUnavailabilityRead])
def list_room_unavailability(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_unavailability")
    ).list(context, page.offset, page.limit)


@router.get("/room-unavailability/{id}", response_model=schemas.RoomUnavailabilityRead)
def get_room_unavailability(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_unavailability")
    ).get(context, {"id": id})


@router.post(
    "/room-unavailability",
    response_model=schemas.RoomUnavailabilityRead,
    status_code=201,
)
def create_room_unavailability(
    payload: schemas.RoomUnavailabilityCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_unavailability")
    ).create(context, payload)


@router.patch(
    "/room-unavailability/{id}", response_model=schemas.RoomUnavailabilityRead
)
def patch_room_unavailability(
    id: UUID,
    payload: schemas.RoomUnavailabilityPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_unavailability")
    ).patch(context, {"id": id}, payload)


@router.delete("/room-unavailability/{id}", status_code=204)
def delete_room_unavailability(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "room_unavailability")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/{id}", response_model=schemas.RoomsRead)
def get_rooms(id: UUID, context: CurrentContextDep, session: SessionDep) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "rooms")
    ).get(context, {"id": id})


@router.patch("/{id}", response_model=schemas.RoomsRead)
def patch_rooms(
    id: UUID,
    payload: schemas.RoomsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return RoomsDomainService(
        session, next(r for r in RESOURCES if r.name == "rooms")
    ).patch(context, {"id": id}, payload)


@router.delete("/{id}", status_code=204)
def delete_rooms(id: UUID, context: CurrentContextDep, session: SessionDep) -> Response:
    RoomsDomainService(session, next(r for r in RESOURCES if r.name == "rooms")).delete(
        context, {"id": id}
    )
    return Response(status_code=204)
