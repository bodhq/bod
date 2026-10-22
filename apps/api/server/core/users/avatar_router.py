from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from starlette.concurrency import run_in_threadpool

from server.core.access.dependencies import AccessServiceDep
from server.core.access.schemas import UserRead
from server.core.auth.dependencies import CurrentContextDep, mutation_guard, no_store
from server.core.exceptions import AppException, ErrorCode, ErrorResponse
from server.core.users.avatar_service import AvatarService
from server.core.users.avatar_storage import (
    AVATAR_CONTENT_TYPES,
    MAX_AVATAR_BYTES,
    AvatarTooLarge,
)


def get_avatar_service(access: AccessServiceDep) -> AvatarService:
    return AvatarService(access)


AvatarServiceDep = Annotated[AvatarService, Depends(get_avatar_service)]
router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(mutation_guard), Depends(no_store)],
    responses={
        code: {"model": ErrorResponse}
        for code in (401, 403, 404, 409, 413, 415, 422, 503)
    },
)
UPLOAD_SCHEMA: dict[str, Any] = {
    "requestBody": {
        "required": True,
        "content": {
            content_type: {"schema": {"type": "string", "format": "binary"}}
            for content_type in sorted(AVATAR_CONTENT_TYPES)
        },
    }
}


@router.put("/me/avatar", response_model=UserRead, openapi_extra=UPLOAD_SCHEMA)
async def upload_my_avatar(
    request: Request, context: CurrentContextDep, service: AvatarServiceDep
) -> UserRead:
    service.access.require(context, "profile.self.update")
    data = await read_image(request)
    return await run_in_threadpool(service.update, context, context.user.id, data)


@router.delete("/me/avatar", status_code=204)
def delete_my_avatar(context: CurrentContextDep, service: AvatarServiceDep) -> None:
    service.delete(context, context.user.id)


AVATAR_RESPONSE: dict[int | str, dict[str, Any]] = {
    200: {"content": {"image/png": {"schema": {"type": "string", "format": "binary"}}}}
}


def image_response(data: bytes) -> Response:
    return Response(
        content=data,
        media_type="image/png",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/{user_id}/avatar", response_class=Response, responses=AVATAR_RESPONSE)
def get_avatar(
    user_id: UUID, context: CurrentContextDep, service: AvatarServiceDep
) -> Response:
    return image_response(service.read(context, user_id))


@router.get(
    "/{user_id}/avatar/{filename}", response_class=Response, responses=AVATAR_RESPONSE
)
def get_avatar_file(
    user_id: UUID, filename: str, context: CurrentContextDep, service: AvatarServiceDep
) -> Response:
    return image_response(service.read(context, user_id, filename))


@router.put("/{user_id}/avatar", response_model=UserRead, openapi_extra=UPLOAD_SCHEMA)
async def upload_avatar(
    user_id: UUID,
    request: Request,
    context: CurrentContextDep,
    service: AvatarServiceDep,
) -> UserRead:
    service.access.require(context, service.permission(context, user_id, write=True))
    data = await read_image(request)
    return await run_in_threadpool(service.update, context, user_id, data)


@router.delete("/{user_id}/avatar", status_code=204)
def delete_avatar(
    user_id: UUID, context: CurrentContextDep, service: AvatarServiceDep
) -> None:
    service.delete(context, user_id)


async def read_image(request: Request) -> bytes:
    content_type = (
        request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    )
    if content_type not in AVATAR_CONTENT_TYPES:
        raise AppException(
            415,
            ErrorCode.MEDIA_UNSUPPORTED_TYPE,
            "Použij Content-Type image/jpeg, image/png nebo image/webp.",
        )
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_AVATAR_BYTES:
            raise AvatarTooLarge()
        data.extend(chunk)
    return bytes(data)
