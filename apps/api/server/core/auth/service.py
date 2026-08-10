from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from server.core.auth.models import AuthSession
from server.core.auth.rate_limit import (
    LoginAttemptLimiter,
    LoginRateLimitExceeded,
)
from server.core.auth.repository import AuthSessionRepository
from server.core.config import settings
from server.core.security import (
    create_session_token,
    hash_session_token,
    verify_password,
)
from server.core.users.models import User
from server.core.users.repository import UserRepository


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    # SQLite testy mohou vracet čas bez timezone.
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value.astimezone(UTC)


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
        login_limiter: LoginAttemptLimiter,
    ) -> None:
        self.users = users
        self.sessions = sessions
        self.login_limiter = login_limiter

    def login(
        self,
        username: str,
        password: str,
        client_ip: str,
        user_agent: str | None,
    ) -> LoginResult | None:
        normalized_username = username.strip().lower()
        self.login_limiter.assert_allowed(normalized_username, client_ip)
        user = self.users.get_by_username(normalized_username)

        if (
            user is None
            or not user.is_active
            or not verify_password(password, user.hashed_password)
        ):
            if self.login_limiter.record_failed_attempt(
                normalized_username,
                client_ip,
            ):
                raise LoginRateLimitExceeded
            return None

        self.login_limiter.reset_failed_attempts(
            normalized_username,
            client_ip,
        )

        raw_token = create_session_token()

        auth_session = AuthSession(
            user_id=user.id,
            token_hash=hash_session_token(raw_token),
            ip_address=client_ip,
            user_agent=user_agent,
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

    def get_user_sessions(self, user: User) -> list[AuthSession]:
        return self.sessions.get_active_for_user(user.id, utcnow())

    def revoke_user_session(
        self,
        user: User,
        session_id: UUID,
    ) -> bool:
        auth_session = self.sessions.get_by_id_and_user_id(
            session_id,
            user.id,
        )

        if auth_session is None:
            return False

        self.sessions.delete(auth_session)
        return True

    
class SessionCleanupService:
    def __init__(
        self,
        sessions: AuthSessionRepository,
    ) -> None:
        self.sessions = sessions

    def remove_expired_sessions(self) -> int:
        return self.sessions.delete_expired(utcnow())
