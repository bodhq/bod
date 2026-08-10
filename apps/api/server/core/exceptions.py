# server/core/exceptions.py
import logging
from enum import StrEnum
from typing import cast

from fastapi import Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ErrorCode(StrEnum):
    AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS"
    AUTH_UNAUTHENTICATED = "AUTH_UNAUTHENTICATED"
    AUTH_ACCOUNT_LOCKED = "AUTH_ACCOUNT_LOCKED"
    AUTH_LOGIN_UNAVAILABLE = "AUTH_LOGIN_UNAVAILABLE"
    AUTH_SESSION_NOT_FOUND = "AUTH_SESSION_NOT_FOUND"

    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"

    VALIDATION_ERROR = "VALIDATION_ERROR"
    DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"


class ErrorDetail(BaseModel):
    code: ErrorCode
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class AppException(Exception):
    def __init__(
        self,
        status_code: int,
        code: ErrorCode,
        message: str,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message


class InvalidCredentialsException(AppException):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_401_UNAUTHORIZED,
            ErrorCode.AUTH_INVALID_CREDENTIALS,
            "Invalid username or password",
        )


class UnauthenticatedException(AppException):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_401_UNAUTHORIZED,
            ErrorCode.AUTH_UNAUTHENTICATED,
            "Authentication is required",
        )


class AccountLockedException(AppException):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_429_TOO_MANY_REQUESTS,
            ErrorCode.AUTH_ACCOUNT_LOCKED,
            "Too many login attempts. Try again later.",
        )


class LoginUnavailableException(AppException):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            ErrorCode.AUTH_LOGIN_UNAVAILABLE,
            "Login is temporarily unavailable.",
        )


class SessionNotFoundException(AppException):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.AUTH_SESSION_NOT_FOUND,
            "Session not found",
        )


class NotFoundException(AppException):
    """Compatibility exception for modules that return a missing resource."""

    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.RESOURCE_NOT_FOUND,
            message,
        )


def error_response(
    status_code: int,
    code: ErrorCode,
    message: str,
) -> JSONResponse:
    body = ErrorResponse(
        error=ErrorDetail(
            code=code,
            message=message,
        )
    )

    return JSONResponse(
        status_code=status_code,
        content=body.model_dump(mode="json"),
    )


async def app_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    app_exception = cast(AppException, exc)

    return error_response(
        app_exception.status_code,
        app_exception.code,
        app_exception.message,
    )


async def validation_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    return error_response(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        ErrorCode.VALIDATION_ERROR,
        "Request validation failed",
    )


async def database_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.exception("Database is unavailable")

    return error_response(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        ErrorCode.DATABASE_UNAVAILABLE,
        "The service is temporarily unavailable.",
    )


async def unexpected_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.exception("Unhandled API exception")

    return error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        "An unexpected error occurred.",
    )
