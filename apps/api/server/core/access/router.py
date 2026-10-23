from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from server.core.access.dependencies import (
    AccessServiceDep,
    Auditor,
    ProfileEditor,
    RolesManager,
    UsersManager,
)
from server.core.audit.models import AuditEvent
from server.core.auth.dependencies import mutation_guard, no_store
from server.core.exceptions import ErrorResponse
from server.core.validation import RoleCode

from .models import Permission
from .schemas import (
    AuditEventRead,
    BatchCreate,
    IssuedAccount,
    PermissionRead,
    ProfilePatch,
    RoleCreate,
    RoleRead,
    RoleWrite,
    UserCreate,
    UserPatch,
    UserRead,
)

ServiceDep = AccessServiceDep
common_dependencies = [Depends(mutation_guard), Depends(no_store)]
error_responses: dict[int | str, dict[str, Any]] = {
    code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 422, 503)
}
admin_router = APIRouter(
    prefix="/admin",
    tags=["administration"],
    dependencies=common_dependencies,
    responses=error_responses,
)
profile_router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=common_dependencies,
    responses=error_responses,
)


@profile_router.patch("/me", response_model=UserRead)
def update_profile(
    payload: ProfilePatch, context: ProfileEditor, service: ServiceDep
) -> UserRead:
    return service.update_profile(context, payload)


class Pagination(BaseModel):
    model_config = ConfigDict(extra="forbid")
    offset: int = Field(default=0, ge=0, le=2_147_483_647)
    limit: int = Field(default=50, ge=1, le=100)


@admin_router.get("/users", response_model=list[UserRead])
def users(
    context: UsersManager, service: ServiceDep, page: Annotated[Pagination, Query()]
) -> list[UserRead]:
    return service.list_users(context, page.offset, page.limit)


@admin_router.post("/users", response_model=IssuedAccount, status_code=201)
def create_user(
    payload: UserCreate, context: UsersManager, service: ServiceDep
) -> IssuedAccount:
    return service.create_users(context, [payload])[0]


@admin_router.post(
    "/users/generate", response_model=list[IssuedAccount], status_code=201
)
def generate_users(
    payload: BatchCreate, context: UsersManager, service: ServiceDep
) -> list[IssuedAccount]:
    return service.create_users(context, payload.users)


@admin_router.get("/users/{user_id}", response_model=UserRead)
def user(user_id: UUID, context: UsersManager, service: ServiceDep) -> UserRead:
    return service.read_user(context, user_id)


@admin_router.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: UUID, payload: UserPatch, context: UsersManager, service: ServiceDep
) -> UserRead:
    return service.update_user(context, user_id, payload)


@admin_router.post("/users/{user_id}/reset-password", response_model=IssuedAccount)
def reset_password(
    user_id: UUID, context: UsersManager, service: ServiceDep
) -> IssuedAccount:
    return service.reset_password(context, user_id)


@admin_router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: UUID, context: UsersManager, service: ServiceDep) -> None:
    service.delete_user(context, user_id)


@admin_router.get("/permissions", response_model=list[PermissionRead])
def permissions(context: RolesManager, service: ServiceDep) -> list[Permission]:
    return service.list_permissions(context)


@admin_router.get("/roles", response_model=list[RoleRead])
def roles(context: RolesManager, service: ServiceDep) -> list[dict[str, object]]:
    return service.list_roles(context)


@admin_router.post("/roles", status_code=201, response_model=RoleRead)
def create_role(
    payload: RoleCreate, context: RolesManager, service: ServiceDep
) -> dict[str, object]:
    return service.write_role(context, payload.code, payload, create=True)


@admin_router.put("/roles/{code}", response_model=RoleRead)
def update_role(
    code: RoleCode, payload: RoleWrite, context: RolesManager, service: ServiceDep
) -> dict[str, object]:
    return service.write_role(context, code, payload)


@admin_router.delete("/roles/{code}", status_code=204)
def delete_role(code: RoleCode, context: RolesManager, service: ServiceDep) -> None:
    service.delete_role(context, code)


@admin_router.get("/audit", response_model=list[AuditEventRead])
def audit(
    context: Auditor, service: ServiceDep, page: Annotated[Pagination, Query()]
) -> list[AuditEvent]:
    return service.read_audit(context, page.offset, page.limit)
