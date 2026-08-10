from typing import Annotated

from fastapi import APIRouter, Cookie, HTTPException, Response, status

from server.core.config import settings
from server.core.auth.dependencies import (
    AuthServiceDep,
    CurrentUserDep,
    cookie_samesite,
    set_session_cookie,
)
from server.core.auth.schemas import LoginRequest
from server.core.users.schemas import UserPublic


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserPublic)
def login(
    payload: LoginRequest,
    response: Response,
    auth_service: AuthServiceDep,
) -> UserPublic:
    result = auth_service.login(payload.email, payload.password)

    if result is None:
        # Stejná odpověď pro neexistující e-mail i špatné heslo.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
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
