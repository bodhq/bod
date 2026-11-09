import os
from uuid import uuid4

import pytest
from redis import Redis
from redis.client import Pipeline
from redis.exceptions import ConnectionError
from server.core.auth.rate_limit import (
    LoginAttemptLimiter,
    LoginRateLimitExceeded,
    LoginRateLimitUnavailable,
)
from server.core.config import settings

from .conftest import FakeRedis


def test_redis_failure_rejects_login(monkeypatch):
    redis = FakeRedis()

    def unavailable(*args, **kwargs):
        raise ConnectionError("lost connection")

    monkeypatch.setattr(redis, "get", unavailable)
    with pytest.raises(LoginRateLimitUnavailable):
        LoginAttemptLimiter(redis).assert_allowed("student", "school")


@pytest.mark.redis
@pytest.mark.parametrize("lost_reply", [False, True])
def test_failure_transaction_keeps_ttl_on_connection_loss(monkeypatch, lost_reply):
    url = os.environ.get("TEST_REDIS_URL")
    if not url:
        pytest.skip("Nastav TEST_REDIS_URL pro skutečný Redis.")
    redis = Redis.from_url(url)
    limiter = LoginAttemptLimiter(redis)
    username, ip = uuid4().hex, uuid4().hex
    keys = [limiter._failure_key(username, ip), limiter._ip_key(ip)]
    execute = Pipeline.execute

    def disconnected(pipeline, *args, **kwargs):
        if lost_reply:
            execute(pipeline, *args, **kwargs)
        raise ConnectionError("connection lost before EXEC or after its reply")

    try:
        with monkeypatch.context() as patch:
            patch.setattr(Pipeline, "execute", disconnected)
            with pytest.raises(LoginRateLimitUnavailable):
                limiter.record_failed_attempt(username, ip)
        # Either no EXEC reached Redis, or the entire transaction was applied.
        if lost_reply:
            assert all(
                0 < redis.ttl(key) <= settings.login_lock_minutes * 60 for key in keys
            )
        else:
            assert [redis.ttl(key) for key in keys] == [-2, -2]
        limiter.record_failed_attempt(username, ip)
        assert all(
            0 < redis.ttl(key) <= settings.login_lock_minutes * 60 for key in keys
        )
        redis.set(keys[1], settings.login_ip_max_failures, ex=60)
        with pytest.raises(LoginRateLimitExceeded):
            limiter.assert_allowed(username, ip)
    finally:
        redis.delete(*keys)
        redis.close()


@pytest.mark.redis
def test_failure_repairs_counter_without_ttl():
    url = os.environ.get("TEST_REDIS_URL")
    if not url:
        pytest.skip("Nastav TEST_REDIS_URL pro skutečný Redis.")
    redis = Redis.from_url(url)
    limiter = LoginAttemptLimiter(redis)
    username, ip = uuid4().hex, uuid4().hex
    keys = [limiter._failure_key(username, ip), limiter._ip_key(ip)]
    try:
        for key in keys:
            redis.set(key, 1)
        limiter.record_failed_attempt(username, ip)
        assert all(redis.ttl(key) > 0 for key in keys)
    finally:
        redis.delete(*keys)
        redis.close()
