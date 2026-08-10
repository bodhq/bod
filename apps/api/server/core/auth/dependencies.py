from typing import Annotated, Literal, cast

from fastapi import Cookie, Depends, Response
from sqlmodel import Session

from server.core.auth.rate_limit import (
    LoginAttemptLimiter,
)
from server.core.auth.repository import AuthSessionRepository
from server.core.auth.service import AuthService
from server.core.config import settings
from server.core.database import get_session
from server.core.exceptions import (
    LoginUnavailableException,
    UnauthenticatedException,
)
from server.core.redis import get_redis_client
from server.core.users.models import User
from server.core.users.repository import UserRepository

SessionDep = Annotated[Session, Depends(get_session)]


def get_login_attempt_limiter() -> LoginAttemptLimiter:
    try:
        return LoginAttemptLimiter(get_redis_client())
    except RuntimeError as error:
        raise LoginUnavailableException() from error


LoginAttemptLimiterDep = Annotated[
    LoginAttemptLimiter,
    Depends(get_login_attempt_limiter),
]


def get_auth_service(
    db: SessionDep,
    login_limiter: LoginAttemptLimiterDep,
) -> AuthService:
    return AuthService(
        users=UserRepository(db),
        sessions=AuthSessionRepository(db),
        login_limiter=login_limiter,
    )


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def cookie_samesite() -> Literal["lax", "strict", "none"]:
    return cast(
        Literal["lax", "strict", "none"],
        settings.cookie_samesite,
    )


def session_max_age() -> int:
    return settings.session_idle_days * 24 * 60 * 60


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=cookie_samesite(),
        max_age=session_max_age(),
        path="/",
    )


def get_current_user(
    response: Response,
    auth_service: AuthServiceDep,
    session_token: Annotated[
        str | None,
        Cookie(alias=settings.session_cookie_name),
    ] = None,
) -> User:
    if session_token is None:
        raise UnauthenticatedException()

    result = auth_service.authenticate_session(session_token)

    if result is None:
        raise UnauthenticatedException()

    if result.session_was_refreshed:
        set_session_cookie(response, session_token)

    return result.user


CurrentUserDep = Annotated[User, Depends(get_current_user)]
