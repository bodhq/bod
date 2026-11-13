"""Isolated database fixtures; never connect to DATABASE_URL from the application."""

import os
from contextlib import ExitStack
from datetime import UTC, datetime, timedelta
from threading import Lock
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["DEBUG"] = "false"

from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import attributes
from sqlalchemy.schema import CreateSchema, DropSchema
from sqlmodel import Session, SQLModel, create_engine

from server import main
from server.core import database
from server.core.access.catalog import PERMISSIONS
from server.core.access.models import Role, RolePermission, UserRole
from server.core.access.repository import AccessRepository
from server.core.access.services import AccessService
from server.core.auth.dependencies import get_login_attempt_limiter
from server.core.auth.models import AuthSession
from server.core.config import settings
from server.core.migrations import migrate
from server.core.security import (
    DUMMY_PASSWORD_HASH,
    get_password_hash,
    hash_session_token,
)
from server.core.users.models import User


@compiles(JSONB, "sqlite")
def jsonb_sqlite(type_, compiler, **kwargs):
    return "JSON"


def restore_utc(target, context, attrs=None):
    for key, value in vars(target).copy().items():
        if isinstance(value, datetime) and value.tzinfo is None:
            attributes.set_committed_value(target, key, value.replace(tzinfo=UTC))


def normalize_utc(session, flush_context, instances):
    # SQLite drops offsets without converting to UTC; mirror PostgreSQL semantics.
    for entity in session.new | session.dirty:
        for key, value in vars(entity).copy().items():
            if isinstance(value, datetime) and value.tzinfo is not None:
                setattr(entity, key, value.astimezone(UTC))


@pytest.fixture(autouse=True)
def isolated_limiter(monkeypatch):
    # Cookie authentication does not call limiter methods. These tests do not
    # depend on Redis configuration from a developer .env file.
    monkeypatch.setitem(
        main.app.dependency_overrides, get_login_attempt_limiter, ValidationLimiter
    )


class ValidationLimiter:
    """Validation/login tests are independent of Redis; limiter has its own suite."""

    def assert_allowed(self, username, client_ip):
        pass

    def reset_failed_attempts(self, username, client_ip):
        pass

    def record_failed_attempt(self, username, client_ip):
        return False


@pytest.fixture
def engine(tmp_path, monkeypatch, request):
    postgres_url = os.environ.get("TEST_POSTGRES_URL")
    if request.node.get_closest_marker("postgres") and not postgres_url:
        pytest.skip("Set TEST_POSTGRES_URL to an isolated PostgreSQL test server.")
    schema = "bod_api_test_" + uuid4().hex
    control = None
    if postgres_url:
        control = create_engine(postgres_url, connect_args={"connect_timeout": 5})
        with control.begin() as connection:
            connection.execute(CreateSchema(schema))
        current = create_engine(
            postgres_url,
            connect_args={
                "connect_timeout": 5,
                "options": f"-c search_path={schema} "
                "-c statement_timeout=30000 -c lock_timeout=15000",
            },
            execution_options={"schema_translate_map": {None: schema}},
        )

        def cleanup_database():
            current.dispose()
            with control.begin() as connection:
                connection.execute(DropSchema(schema, cascade=True))
            control.dispose()

        # Register cleanup before migration so setup failures cannot leak schemas.
        request.addfinalizer(cleanup_database)
        migrate(current)
    else:
        current = create_engine(
            f"sqlite:///{tmp_path / 'api.sqlite3'}",
            connect_args={"check_same_thread": False},
        )

        @event.listens_for(current, "connect")
        def setup(connection, record):
            connection.execute("PRAGMA foreign_keys=ON")
            connection.create_function("btrim", 1, lambda value: value.strip(" "))
            connection.create_function(
                "school_date",
                1,
                lambda value: (
                    datetime.fromisoformat(value)
                    .replace(tzinfo=UTC)
                    .astimezone(ZoneInfo("Europe/Prague"))
                    .date()
                    .isoformat()
                ),
            )

        lock = Lock()

        def lock_management(repository):
            if not repository.db.info.get("test_domain_lock"):
                lock.acquire()
                repository.db.info["test_domain_lock"] = True

        def release(session, transaction):
            if transaction.parent is None and session.info.pop(
                "test_domain_lock", False
            ):
                lock.release()

        monkeypatch.setattr(AccessRepository, "lock_management", lock_management)
        event.listen(Session, "after_transaction_end", release)
        event.listen(Session, "before_flush", normalize_utc)
        SQLModel.metadata.create_all(current)
    models = list(SQLModel._sa_registry.mappers)
    for mapper in models:
        event.listen(mapper.class_, "load", restore_utc)
        event.listen(mapper.class_, "refresh", restore_utc)
    monkeypatch.setattr(database, "engine", current)
    monkeypatch.setattr(main, "engine", current)
    monkeypatch.setattr(main, "init_db", lambda: None)
    monkeypatch.setattr(settings, "cookie_secure", False)
    with Session(current) as db:
        AccessService(AccessRepository(db)).seed_catalog()
        db.commit()
    try:
        yield current
    finally:
        main.app.dependency_overrides.clear()
        for mapper in models:
            event.remove(mapper.class_, "load", restore_utc)
            event.remove(mapper.class_, "refresh", restore_utc)
        if not postgres_url:
            event.remove(Session, "after_transaction_end", release)
            event.remove(Session, "before_flush", normalize_utc)
        if not control:
            current.dispose()


@pytest.fixture
def clients(engine):
    with ExitStack() as stack:

        def create(
            role="school_manager", permissions=None, *, username=None, password=None
        ):
            if permissions is None:
                permissions = (
                    set(PERMISSIONS) if role == "school_manager" else {"timetable.read"}
                )
            token = uuid4().hex
            with Session(engine) as db:
                if db.get(Role, role) is None:
                    db.add(Role(code=role, name=role))
                    db.flush()
                existing = AccessRepository(db).permission_codes(role)
                for permission in set(permissions) - existing:
                    db.add(RolePermission(role_code=role, permission_code=permission))
                user = User(
                    username=username or "u" + uuid4().hex,
                    hashed_password=get_password_hash(password)
                    if password
                    else DUMMY_PASSWORD_HASH,
                    must_change_password=False,
                )
                db.add(user)
                db.flush()
                db.add(UserRole(user_id=user.id, role_code=role))
                db.flush()
                db.add(
                    AuthSession(
                        user_id=user.id,
                        active_role_code=role,
                        token_hash=hash_session_token(token),
                        expires_at=datetime.now(UTC) + timedelta(days=1),
                    )
                )
                user_id = user.id
                db.commit()
            client = stack.enter_context(
                TestClient(main.app, headers={"X-Requested-With": "bod"})
            )
            client.cookies.set("session_id", token)
            client.actor_id = user_id
            return client

        yield create


@pytest.fixture
def api(clients):
    return clients()


@pytest.fixture
def client(engine):
    with TestClient(main.app, headers={"X-Requested-With": "bod"}) as client:
        yield client


@pytest.fixture
def admin(clients):
    return clients("admin", set(), username="root", password="NoveHesloProAdmina2026!")


@pytest.fixture
def teacher(clients):
    return clients(
        "teacher",
        {
            "timetable.read",
            "classbook.read",
            "classbook.write",
            "classbook.correct",
            "attendance.mark",
            "attendance.excuse",
        },
    )


@pytest.fixture
def student(clients):
    return clients(
        "student", {"timetable.read", "classbook.read", "attendance.request"}
    )
