from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "bod API"
    version: str = "0.1.0"
    debug: bool = True

    database_url: str = "postgresql+psycopg://bod:bod@localhost:5432/bod"

    model_config = SettingsConfigDict(
        env_file="../../.env", env_file_encoding="utf-8", extra="ignore"
    )

    @model_validator(mode="after")
    def _fix_database_url(self) -> "Settings":
        """Oprava pro psycopg 3 — automaticky přidá +psycopg driver."""
        if self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace(
                "postgresql://", "postgresql+psycopg://", 1
            )
        return self


settings = Settings()
