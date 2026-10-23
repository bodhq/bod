from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Request, Response
from starlette.concurrency import run_in_threadpool

from server.core.access.dependencies import AccessServiceDep
from server.core.access.schemas import UserRead
from server.core.auth.dependencies import CurrentContextDep, mutation_guard, no_store
from server.core.exceptions import AppException, ErrorCode, ErrorResponse
from server.core.users.avatar_service import AvatarImage, AvatarService
from server.core.users.avatar_storage import (
    AVATAR_CONTENT_TYPES,
    AVATAR_QUALITY,
    MAX_AVATAR_BYTES,
    MAX_AVATAR_PIXELS,
    AvatarTooLarge,
)
from server.core.validation import AVATAR_FILENAME_PATTERN


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
        "description": (
            "Syrové binární tělo JPG/JPEG, PNG nebo WebP; ne form-data ani base64. "
            f"1–{MAX_AVATAR_BYTES} bajtů, nejvýše {MAX_AVATAR_PIXELS} pixelů. "
            "Pouze neanimovaný obrázek; server odstraní metadata a zmenší jej "
            f"do 512 × 512 px a uloží jako WebP s kvalitou {AVATAR_QUALITY}. "
            "JPG i JPEG používají image/jpeg; podporovaný je také alias image/jpg. "
            "Velikost se ověřuje během čtení streamu."
        ),
        "content": {
            content_type: {
                "schema": {
                    "type": "string",
                    "format": "binary",
                    "x-maxSizeBytes": MAX_AVATAR_BYTES,
                    "x-maxPixels": MAX_AVATAR_PIXELS,
                    "x-animated": False,
                    "x-outputFormat": "webp",
                    "x-outputQuality": AVATAR_QUALITY,
                }
            }
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
    200: {
        "content": {
            media_type: {"schema": {"type": "string", "format": "binary"}}
            for media_type in ("image/webp", "image/png")
        },
        "description": "WebP profilovka; původní PNG zůstávají dostupné do výměny.",
    }
}


def image_response(image: AvatarImage) -> Response:
    return Response(
        content=image.data,
        media_type=image.media_type,
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
    user_id: UUID,
    filename: Annotated[
        str, Path(min_length=36, max_length=37, pattern=AVATAR_FILENAME_PATTERN)
    ],
    context: CurrentContextDep,
    service: AvatarServiceDep,
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
            "Použij Content-Type image/jpeg (JPG/JPEG), image/jpg, "
            "image/png nebo image/webp.",
        )
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_AVATAR_BYTES:
            raise AvatarTooLarge()
        data.extend(chunk)
    return bytes(data)
