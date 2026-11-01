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
            failures = int(self.redis.get(self._failure_key(username, client_ip)) or 0)
            ip_failures = int(self.redis.get(self._ip_key(client_ip)) or 0)
        except RedisError as error:
            raise LoginRateLimitUnavailable from error

        if (
            failures >= settings.login_max_failures
            or ip_failures >= settings.login_ip_max_failures
        ):
            raise LoginRateLimitExceeded

    def record_failed_attempt(self, username: str, client_ip: str) -> bool:
        try:
            # MULTI/EXEC applies both counters and TTLs together, including on
            # connection loss. Each failure restarts the inactivity window.
            with self.redis.pipeline(transaction=True) as pipeline:
                pipeline.incr(self._failure_key(username, client_ip))
                pipeline.expire(
                    self._failure_key(username, client_ip), self._window_seconds()
                )
                pipeline.incr(self._ip_key(client_ip))
                pipeline.expire(self._ip_key(client_ip), self._window_seconds())
                failed_attempts, _, ip_failures, _ = pipeline.execute()
        except RedisError as error:
            raise LoginRateLimitUnavailable from error

        return (
            int(failed_attempts) >= settings.login_max_failures
            or int(ip_failures) >= settings.login_ip_max_failures
        )

    def reset_failed_attempts(self, username: str, client_ip: str) -> None:
        try:
            # A successful login must not erase other accounts' IP failures.
            self.redis.delete(self._failure_key(username, client_ip))
        except RedisError as error:
            raise LoginRateLimitUnavailable from error

    def _window_seconds(self) -> int:
        return settings.login_lock_minutes * 60

    def _failure_key(self, username: str, client_ip: str) -> str:
        return f"auth:login:fail:{self._identifier_hash(username, client_ip)}"

    def _ip_key(self, client_ip: str) -> str:
        return f"auth:login:ip:{self._identifier_hash(client_ip)}"

    @staticmethod
    def _identifier_hash(*values: str) -> str:
        joined_values = ":".join(values)
        return sha256(joined_values.encode("utf-8")).hexdigest()
