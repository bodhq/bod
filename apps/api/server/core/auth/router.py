from typing import Annotated

from uuid import UUID
from fastapi import APIRouter, Cookie, HTTPException, Request, Response, status

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
from server.core.auth.schemas import LoginRequest
from server.core.config import settings
from server.core.users.schemas import UserPublic
from server.core.auth.schemas import AuthSessionPublic, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserPublic)
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
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again later.",
        ) from error
    except LoginRateLimitUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login is temporarily unavailable.",
        ) from error

    if result is None:
        # Stejná odpověď pro neexistující e-mail i špatné heslo.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    set_session_cookie(response, result.session_token)

    return UserPublic.model_validate(result.user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
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


@router.get("/me", response_model=UserPublic)
def me(current_user: CurrentUserDep) -> UserPublic:
    return UserPublic.model_validate(current_user)

@router.get("/sessions", response_model=list[AuthSessionPublic])
def get_sessions(
    current_user: CurrentUserDep,
    auth_service: AuthServiceDep,
) -> list[AuthSessionPublic]:
    sessions = auth_service.get_user_sessions(current_user)

    return [
        AuthSessionPublic.model_validate(session)
        for session in sessions
    ]

@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )