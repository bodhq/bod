from typing import Annotated, Literal, cast

from fastapi import Cookie, Depends, HTTPException, Response, status
from sqlmodel import Session

from server.core.config import settings
from server.core.database import get_session
from server.modules.auth.repository import AuthSessionRepository
from server.modules.auth.service import AuthService
from server.modules.users.models import User
from server.modules.users.repository import UserRepository


SessionDep = Annotated[Session, Depends(get_session)]


def get_auth_service(db: SessionDep) -> AuthService:
    return AuthService(
        users=UserRepository(db),
        sessions=AuthSessionRepository(db),
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    result = auth_service.authenticate_session(session_token)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    if result.session_was_refreshed:
        set_session_cookie(response, session_token)

    return result.user


CurrentUserDep = Annotated[User, Depends(get_current_user)]