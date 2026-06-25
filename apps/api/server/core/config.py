from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "bod API"
    version: str = "0.1.0"

    database_url: str = "postgresql+psycopg://bod:bod@localhost:5432/bod"

    model_config = SettingsConfigDict(
        env_file="../../.env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()

# Fix for psycopg 3
if settings.database_url.startswith("postgresql://"):
    settings.database_url = settings.database_url.replace(
        "postgresql://", "postgresql+psycopg://", 1
    )
