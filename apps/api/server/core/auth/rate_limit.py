from hashlib import sha256

from redis import Redis
from redis.exceptions import RedisError

from server.core.config import settings


class LoginRateLimitExceeded(Exception):
    """The login attempt exceeded an IP or username lock limit."""


class LoginRateLimitUnavailable(Exception):
    """Redis is unavailable, so the login limiter cannot enforce policy."""


class LoginAttemptLimiter:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    def assert_allowed(self, username: str, client_ip: str) -> None:
        try:
            if self.redis.exists(self._lock_key(username, client_ip)):
                raise LoginRateLimitExceeded

            ip_count = int(self.redis.incr(self._ip_key(client_ip)))

            if ip_count == 1:
                self.redis.expire(
                    self._ip_key(client_ip),
                    self._window_seconds(),
                )
        except RedisError as error:
            raise LoginRateLimitUnavailable from error

        if ip_count > settings.login_ip_max_requests:
            raise LoginRateLimitExceeded

    def record_failed_attempt(self, username: str, client_ip: str) -> bool:
        try:
            failure_key = self._failure_key(username, client_ip)
            failed_attempts = int(self.redis.incr(failure_key))
            self.redis.expire(failure_key, self._window_seconds())

            if failed_attempts >= settings.login_max_failures:
                self.redis.set(
                    self._lock_key(username, client_ip),
                    "1",
                    ex=self._window_seconds(),
                )
                return True
        except RedisError as error:
            raise LoginRateLimitUnavailable from error

        return False

    def reset_failed_attempts(self, username: str, client_ip: str) -> None:
        try:
            self.redis.delete(
                self._failure_key(username, client_ip),
                self._lock_key(username, client_ip),
            )
        except RedisError as error:
            raise LoginRateLimitUnavailable from error

    def _window_seconds(self) -> int:
        return settings.login_lock_minutes * 60

    def _failure_key(self, username: str, client_ip: str) -> str:
        return f"auth:login:fail:{self._identifier_hash(username, client_ip)}"

    def _lock_key(self, username: str, client_ip: str) -> str:
        return f"auth:login:lock:{self._identifier_hash(username, client_ip)}"

    def _ip_key(self, client_ip: str) -> str:
        return f"auth:login:ip:{self._identifier_hash(client_ip)}"

    @staticmethod
    def _identifier_hash(*values: str) -> str:
        joined_values = ":".join(values)
        return sha256(joined_values.encode("utf-8")).hexdigest()
