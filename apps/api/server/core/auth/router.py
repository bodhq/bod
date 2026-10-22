from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Cookie, Depends, Request, Response, status

from server.core.access.dependencies import AccessServiceDep, require_permission
from server.core.access.schemas import PasswordChange, RoleSwitch
from server.core.auth.dependencies import (
    AuthServiceDep,
    CurrentContextDep,
    CurrentUserDep,
    cookie_samesite,
    mutation_guard,
    no_store,
    set_session_cookie,
)
from server.core.auth.rate_limit import (
    LoginRateLimitExceeded,
    LoginRateLimitUnavailable,
)
from server.core.auth.schemas import AuthSessionPublic, LoginRequest
from server.core.config import settings
from server.core.exceptions import (
    AccountLockedException,
    ErrorResponse,
    InvalidCredentialsException,
    LoginUnavailableException,
    SessionNotFoundException,
)
from server.core.users.schemas import UserPublic

LOGIN_ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {
        "model": ErrorResponse,
        "description": "Invalid credentials",
    },
    422: {
        "model": ErrorResponse,
        "description": "Invalid request body",
    },
    429: {
        "model": ErrorResponse,
        "description": "Login is temporarily locked",
    },
    503: {
        "model": ErrorResponse,
        "description": "Login or database is temporarily unavailable",
    },
}

AUTH_REQUIRED_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {
        "model": ErrorResponse,
        "description": "Authentication is required",
    },
    503: {
        "model": ErrorResponse,
        "description": "Service or database is temporarily unavailable",
    },
}

SESSION_REVOKE_ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    **AUTH_REQUIRED_RESPONSES,
    404: {
        "model": ErrorResponse,
        "description": "The requested session does not exist",
    },
    422: {
        "model": ErrorResponse,
        "description": "Invalid session ID",
    },
}

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
    dependencies=[Depends(mutation_guard), Depends(no_store)],
    responses={code: {"model": ErrorResponse} for code in (401, 403, 422, 503)},
)


@router.post(
    "/login",
    response_model=UserPublic,
    responses=LOGIN_ERROR_RESPONSES,
)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    auth_service: AuthServiceDep,
) -> UserPublic:
    client_ip = request.client.host if request.client is not None else "unknown"
    user_agent = request.headers.get("user-agent")

    try:
        result = auth_service.login(
            payload.username,
            payload.password,
            client_ip,
            user_agent,
        )
    except LoginRateLimitExceeded as error:
        raise AccountLockedException() from error
    except LoginRateLimitUnavailable as error:
        raise LoginUnavailableException() from error

    if result is None:
        raise InvalidCredentialsException()

    set_session_cookie(response, result.session_token)

    return UserPublic.model_validate(auth_service.access.me(result.context))


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        503: AUTH_REQUIRED_RESPONSES[503],
    },
)
def logout(
    response: Response,
    auth_service: AuthServiceDep,
    session_token: Annotated[
        str | None,
        Cookie(alias=settings.session_cookie_name),
    ] = None,
) -> None:
    auth_service.logout(session_token)

    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=settings.cookie_secure,
        samesite=cookie_samesite(),
    )


@router.get(
    "/me",
    response_model=UserPublic,
    responses=AUTH_REQUIRED_RESPONSES,
)
def me(context: CurrentContextDep, service: AccessServiceDep) -> UserPublic:
    return UserPublic.model_validate(service.me(context))


@router.put("/active-role", response_model=UserPublic)
def switch_role(
    payload: RoleSwitch, context: CurrentContextDep, service: AccessServiceDep
) -> UserPublic:
    updated = service.switch_role(context, payload.role_code)
    return UserPublic.model_validate(service.me(updated))


@router.post("/change-password", response_model=UserPublic)
def change_password(
    payload: PasswordChange,
    context: CurrentContextDep,
    service: AccessServiceDep,
    response: Response,
) -> UserPublic:
    token, updated = service.change_password(
        context, payload.current_password, payload.new_password
    )
    set_session_cookie(response, token)
    return UserPublic.model_validate(service.me(updated))


@router.get(
    "/sessions",
    response_model=list[AuthSessionPublic],
    responses=AUTH_REQUIRED_RESPONSES,
    dependencies=[Depends(require_permission("profile.self.read"))],
)
def get_sessions(
    current_user: CurrentUserDep,
    auth_service: AuthServiceDep,
) -> list[AuthSessionPublic]:
    sessions = auth_service.get_user_sessions(current_user)

    return [AuthSessionPublic.model_validate(session) for session in sessions]


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=SESSION_REVOKE_ERROR_RESPONSES,
    dependencies=[Depends(require_permission("profile.self.read"))],
)
def revoke_session(
    session_id: UUID,
    current_user: CurrentUserDep,
    auth_service: AuthServiceDep,
) -> None:
    was_deleted = auth_service.revoke_user_session(
        current_user,
        session_id,
    )

    if not was_deleted:
        raise SessionNotFoundException()
