"""Adaptér PostgreSQL modelů pro rychlé API testy na SQLite.

Neověřuje PostgreSQL SQL ani jeho advisory locky. Souběžné změny v testech
serializuje lokálním zámkem drženým až do konce databázové transakce.
"""

from collections.abc import Generator
from contextlib import contextmanager
from datetime import UTC, datetime
from threading import Lock

import pytest
from server.core.access.repository import AccessRepository
from server.core.audit.models import AuditEvent
from server.core.auth.models import AuthSession
from server.core.users.models import User
from sqlalchemy import Engine, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import attributes
from sqlmodel import Session


@compiles(JSONB, "sqlite")
def compile_jsonb_for_sqlite(type_, compiler, **kwargs):
    # JSONB používá stejné Python serializéry jako JSON; liší se SQL typ.
    return "JSON"


def restore_utc(target, context, attrs=None):
    # SQLite driver nevrací timezone, PostgreSQL timestamptz ano.
    for name, value in list(vars(target).items()):
        if isinstance(value, datetime) and value.tzinfo is None:
            attributes.set_committed_value(target, name, value.replace(tzinfo=UTC))


@contextmanager
def sqlite_support(
    engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> Generator[None, None, None]:
    lock = Lock()
    lock_key = "sqlite_test_management_lock"

    def configure_connection(connection, record):
        connection.execute("PRAGMA foreign_keys = ON")
        connection.create_function("btrim", 1, lambda value: value.strip(" "))

    def acquire_management(repository: AccessRepository) -> None:
        if not repository.db.info.get(lock_key):
            lock.acquire()
            repository.db.info[lock_key] = True

    def release_management(session, transaction):
        if transaction.parent is None and session.info.pop(lock_key, False):
            lock.release()

    event.listen(engine, "connect", configure_connection)
    event.listen(Session, "after_transaction_end", release_management)
    models = (User, AuthSession, AuditEvent)
    for model in models:
        event.listen(model, "load", restore_utc)
        event.listen(model, "refresh", restore_utc)
    monkeypatch.setattr(AccessRepository, "lock_management", acquire_management)
    try:
        yield
    finally:
        for model in models:
            event.remove(model, "load", restore_utc)
            event.remove(model, "refresh", restore_utc)
        event.remove(Session, "after_transaction_end", release_management)
        event.remove(engine, "connect", configure_connection)
