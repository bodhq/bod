from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from server.core.config import settings
from server.core.security import (
    create_session_token,
    hash_session_token,
    verify_password,
)
from server.core.auth.models import AuthSession
from server.core.auth.repository import AuthSessionRepository
from server.core.users.models import User
from server.core.users.repository import UserRepository


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    # SQLite testy mohou vracet čas bez timezone.
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


@dataclass(frozen=True)
class LoginResult:
    user: User
    session_token: str


@dataclass(frozen=True)
class AuthenticatedUser:
    user: User
    session_was_refreshed: bool


class AuthService:
    def __init__(
        self,
        users: UserRepository,
        sessions: AuthSessionRepository,
    ) -> None:
        self.users = users
        self.sessions = sessions

    def login(self, email: str, password: str) -> LoginResult | None:
        normalized_email = email.strip().lower()
        user = self.users.get_by_email(normalized_email)

        if (
            user is None
            or not user.is_active
            or not verify_password(password, user.hashed_password)
        ):
            return None

        raw_token = create_session_token()

        auth_session = AuthSession(
            user_id=user.id,
            token_hash=hash_session_token(raw_token),
            expires_at=utcnow() + timedelta(
                days=settings.session_idle_days
            ),
        )

        self.sessions.create(auth_session)

        return LoginResult(
            user=user,
            session_token=raw_token,
        )

    def authenticate_session(
        self,
        raw_token: str,
    ) -> AuthenticatedUser | None:
        token_hash = hash_session_token(raw_token)

        auth_session = self.sessions.get_by_token_hash(token_hash)

        if auth_session is None:
            return None

        now = utcnow()

        if as_utc(auth_session.expires_at) <= now:
            self.sessions.delete(auth_session)
            return None

        user = self.users.get_by_id(auth_session.user_id)

        if user is None or not user.is_active:
            self.sessions.delete(auth_session)
            return None

        refresh_threshold = timedelta(
            days=settings.session_refresh_threshold_days
        )

        session_was_refreshed = False

        if as_utc(auth_session.expires_at) - now <= refresh_threshold:
            auth_session.expires_at = now + timedelta(
                days=settings.session_idle_days
            )
            auth_session.last_seen_at = now

            self.sessions.save(auth_session)
            session_was_refreshed = True

        return AuthenticatedUser(
            user=user,
            session_was_refreshed=session_was_refreshed,
        )

    def logout(self, raw_token: str | None) -> None:
        if raw_token is None:
            return

        token_hash = hash_session_token(raw_token)
        auth_session = self.sessions.get_by_token_hash(token_hash)

        if auth_session is not None:
            self.sessions.delete(auth_session)
