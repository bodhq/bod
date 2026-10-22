from collections.abc import Callable
from typing import Annotated

from fastapi import Depends

from server.core.auth.dependencies import CurrentContextDep, SessionDep

from .repository import AccessRepository
from .services import AccessContext, AccessService


def get_access_service(db: SessionDep) -> AccessService:
    return AccessService(AccessRepository(db))


AccessServiceDep = Annotated[AccessService, Depends(get_access_service)]


def require_permission(
    permission: str,
) -> Callable[..., AccessContext]:
    def check(context: CurrentContextDep, service: AccessServiceDep) -> AccessContext:
        service.require(context, permission)
        return context

    return check


UsersManager = Annotated[AccessContext, Depends(require_permission("users.manage"))]
RolesManager = Annotated[AccessContext, Depends(require_permission("roles.manage"))]
ProfileEditor = Annotated[
    AccessContext, Depends(require_permission("profile.self.update"))
]
Auditor = Annotated[AccessContext, Depends(require_permission("audit.read"))]
