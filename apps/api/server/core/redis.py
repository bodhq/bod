from functools import lru_cache

from redis import Redis

from server.core.config import settings


@lru_cache
def get_redis_client() -> Redis:
    if settings.redis_url is None:
        raise RuntimeError("Redis is not configured.")

    return Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        health_check_interval=30,
    )
