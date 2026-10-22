import os
from collections.abc import Generator
from contextlib import contextmanager, nullcontext
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.schema import CreateSchema, DropSchema
from sqlmodel import Session, SQLModel, create_engine

# Testy nepoužívají připojení aplikace z .env ani její data.
os.environ["DATABASE_URL"] = "sqlite://"

os.environ["DEBUG"] = "false"

import server.core.database as database  # noqa: E402
import server.main as main  # noqa: E402
from server.core.access.repository import AccessRepository  # noqa: E402
from server.core.access.services import AccessService  # noqa: E402
from server.core.auth.dependencies import get_login_attempt_limiter  # noqa: E402
from server.core.auth.rate_limit import LoginAttemptLimiter  # noqa: E402
from server.core.config import settings  # noqa: E402
from server.core.migrations import migrate  # noqa: E402
from sqlite_support import sqlite_support  # noqa: E402

HEADERS = {"X-Requested-With": "bod"}


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    def exists(self, key: str) -> int:
        return int(key in self.values)

    def incr(self, key: str) -> int:
        value = int(self.values.get(key, "0")) + 1
        self.values[key] = str(value)
        return value

    def expire(self, key: str, seconds: int) -> bool:
        return True

    def set(self, key: str, value: str, ex: int) -> bool:
        self.values[key] = value
        return True

    def delete(self, *keys: str) -> int:
        deleted_keys = 0

        for key in keys:
            if key in self.values:
                del self.values[key]
                deleted_keys += 1

        return deleted_keys


@contextmanager
def postgres_database(url: str) -> Generator[Engine, None, None]:
    # Pouze volitelné testy skutečného PostgreSQL migračního SQL.
    schema = f"bod_test_{uuid4().hex}"
    url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    control = create_engine(url, connect_args={"connect_timeout": 5})
    with control.begin() as connection:
        connection.execute(CreateSchema(schema))
    engine = create_engine(
        url,
        connect_args={"connect_timeout": 5, "options": f"-c search_path={schema}"},
        execution_options={"schema_translate_map": {None: schema}},
    )
    try:
        yield engine
    finally:
        engine.dispose()
        with control.begin() as connection:
            connection.execute(DropSchema(schema, cascade=True))
        control.dispose()


@pytest.fixture
def db_engine(
    request: pytest.FixtureRequest,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> Generator[Engine, None, None]:
    postgres = request.node.get_closest_marker("postgres") is not None
    if postgres:
        url = os.environ.get("TEST_POSTGRES_URL")
        if not url:
            pytest.skip("Volitelná PostgreSQL migrace: nastav TEST_POSTGRES_URL.")
        database_context = postgres_database(url)
    else:
        engine = create_engine(
            f"sqlite:///{tmp_path / 'test.sqlite3'}",
            connect_args={"check_same_thread": False, "timeout": 15},
        )
        database_context = nullcontext(engine)

    with database_context as engine:
        support = nullcontext() if postgres else sqlite_support(engine, monkeypatch)
        with support:
            monkeypatch.setattr(database, "engine", engine)
            monkeypatch.setattr(main, "engine", engine)
            monkeypatch.setattr(settings, "cookie_secure", False)
            monkeypatch.setattr(settings, "media_root", tmp_path / "media")
            limiter = LoginAttemptLimiter(FakeRedis())
            main.app.dependency_overrides[get_login_attempt_limiter] = lambda: limiter
            try:
                if postgres:
                    migrate(engine)
                else:
                    SQLModel.metadata.create_all(engine)
                    with Session(engine) as db:
                        AccessService(AccessRepository(db)).seed_catalog()
                        db.commit()
                # Schéma už připravila fixture. PostgreSQL migrace se na SQLite
                # nespouštějí; jejich SQL má vlastní volitelné integrační testy.
                monkeypatch.setattr(main, "init_db", lambda: None)
                yield engine
            finally:
                main.app.dependency_overrides.clear()
                engine.dispose()


@pytest.fixture
def db(db_engine: Engine) -> Generator[Session, None, None]:
    with Session(db_engine) as session:
        yield session


@pytest.fixture
def session(db: Session) -> Session:
    return db


@pytest.fixture
def client(db_engine: Engine) -> Generator[TestClient, None, None]:
    # Každý HTTP požadavek používá vlastní databázovou transakci stejně jako API.
    with TestClient(main.app, headers=HEADERS) as client:
        yield client


@pytest.fixture
def root_credentials(db_engine: Engine):
    with Session(db_engine) as db:
        return AccessService(AccessRepository(db)).bootstrap()


@pytest.fixture
def admin(client: TestClient, root_credentials):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": root_credentials.user.username,
            "password": root_credentials.temporary_password,
        },
    )
    assert response.status_code == 200, response.text
    response = client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": root_credentials.temporary_password,
            "new_password": "NoveHesloProAdmina2026!",
        },
    )
    assert response.status_code == 200, response.text
    return client
