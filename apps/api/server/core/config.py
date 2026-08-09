from pathlib import Path
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict



PROJECT_ROOT = Path(__file__).resolve().parents[4]
class Settings(BaseSettings):
    database_url: str
    redis_url: str | None = None

    session_cookie_name: str = "session_id"
    session_idle_days: int = 7
    session_refresh_threshold_days: int = 2

    cookie_secure: bool = True
    cookie_samesite: str = "lax"

    project_name: str = "bod API"
    version: str = "0.1.0"
    debug: bool = True

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @model_validator(mode="after")
    def _fix_database_url(self) -> "Settings":
        """Oprava pro psycopg 3 — automaticky přidá +psycopg driver."""
        if self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace(
                "postgresql://", "postgresql+psycopg://", 1
            )
        return self

settings = Settings(**{})