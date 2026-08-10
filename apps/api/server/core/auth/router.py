from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Cookie, Request, Response, status

from server.core.auth.dependencies import (
    AuthServiceDep,
    CurrentUserDep,
    cookie_samesite,
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

router = APIRouter(prefix="/auth", tags=["auth"])


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

    return UserPublic.model_validate(result.user)


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
def me(current_user: CurrentUserDep) -> UserPublic:
    return UserPublic.model_validate(current_user)


@router.get(
    "/sessions",
    response_model=list[AuthSessionPublic],
    responses=AUTH_REQUIRED_RESPONSES,
)
def get_sessions(
    current_user: CurrentUserDep,
    auth_service: AuthServiceDep,
) -> list[AuthSessionPublic]:
    sessions = auth_service.get_user_sessions(current_user)

    return [
        AuthSessionPublic.model_validate(session)
        for session in sessions
    ]

@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=SESSION_REVOKE_ERROR_RESPONSES,
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
