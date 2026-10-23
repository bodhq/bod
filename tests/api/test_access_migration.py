from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from server.core.access.models import RolePermission, UserRole
from server.core.access.repository import AccessRepository
from server.core.access.services import AccessService
from server.core.auth.models import AuthSession
from server.core.migrations import migrate
from server.core.security import get_password_hash, verify_password
from server.core.users.models import User
from sqlalchemy import inspect, text
from sqlmodel import Session, select


def make_legacy_schema(engine, users):
    # Fixture engine ukazuje výhradně na nové bod_test_<uuid> schéma.
    with engine.begin() as connection:
        schema = connection.execute(text("SELECT current_schema()")).scalar_one()
        assert schema.startswith("bod_test_")
        connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(
            text("CREATE TYPE role AS ENUM ('STUDENT', 'TEACHER', 'ADMIN')")
        )
        connection.execute(
            text(
                "CREATE TABLE users (id uuid PRIMARY KEY, "
                "username varchar NOT NULL UNIQUE, "
                "hashed_password varchar NOT NULL, role role NOT NULL, "
                "is_active boolean NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE auth_sessions (id uuid PRIMARY KEY, "
                "user_id uuid NOT NULL "
                "REFERENCES users(id), token_hash varchar NOT NULL UNIQUE, "
                "ip_address varchar(45), user_agent varchar(512), "
                "expires_at timestamp NOT NULL, created_at timestamp NOT NULL, "
                "last_seen_at timestamp NOT NULL)"
            )
        )
        for user in users:
            connection.execute(
                text(
                    "INSERT INTO users VALUES (:id, :username, :password, "
                    "CAST(:role AS role), :active)"
                ),
                user,
            )


@pytest.mark.postgres
def test_migration_preserves_users_passwords_and_sessions(db_engine):
    password = get_password_hash("MojePuvodniHeslo123")
    admin_id, teacher_id, session_id = uuid4(), uuid4(), uuid4()
    make_legacy_schema(
        db_engine,
        [
            dict(
                id=admin_id,
                username="Admin",
                password=password,
                role="ADMIN",
                active=True,
            ),
            dict(
                id=teacher_id,
                username="teacher",
                password=password,
                role="TEACHER",
                active=False,
            ),
        ],
    )
    now = datetime.now(UTC).replace(tzinfo=None)
    with db_engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, "
                "created_at, last_seen_at) "
                "VALUES (:id, :user, 'hash', :expires, :now, :now)"
            ),
            dict(
                id=session_id, user=admin_id, expires=now + timedelta(days=1), now=now
            ),
        )
    migrate(db_engine)
    migrate(db_engine)
    with Session(db_engine) as db:
        admin = db.get(User, admin_id)
        assert admin.username == "admin"
        assert verify_password("MojePuvodniHeslo123", admin.hashed_password)
        assert not admin.must_change_password
        assert db.get(UserRole, (admin_id, "admin")) is not None
        assert db.get(UserRole, (teacher_id, "teacher")) is not None
        assert not db.get(User, teacher_id).is_active
        session = db.get(AuthSession, session_id)
        assert session.active_role_code == "admin"
        assert session.token_hash == "hash"
        assert session.created_at == now.replace(tzinfo=UTC)
        assert AccessService(AccessRepository(db)).bootstrap() is None
        assert len(db.exec(select(User)).all()) == 2
    assert "role" not in {c["name"] for c in inspect(db_engine).get_columns("users")}


@pytest.mark.postgres
def test_migration_collision_rolls_back_without_dropping_roles(db_engine):
    make_legacy_schema(
        db_engine,
        [
            dict(
                id=uuid4(), username="Admin", password="hash", role="ADMIN", active=True
            ),
            dict(
                id=uuid4(), username="admin", password="hash", role="ADMIN", active=True
            ),
        ],
    )
    with pytest.raises(RuntimeError, match="kolidující"):
        migrate(db_engine)
    with db_engine.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM users")).scalar_one() == 2
        assert "role" in {c["name"] for c in inspect(connection).get_columns("users")}
        assert "must_change_password" not in {
            c["name"] for c in inspect(connection).get_columns("users")
        }


def test_restarting_does_not_restore_removed_role_permissions(db_engine):
    with Session(db_engine) as db:
        grant = db.get(RolePermission, ("teacher", "profile.self.update"))
        db.delete(grant)
        db.commit()
    with Session(db_engine) as db:
        AccessService(AccessRepository(db)).seed_catalog()
        db.commit()
    with Session(db_engine) as db:
        AccessService(AccessRepository(db)).bootstrap()
        assert db.get(RolePermission, ("teacher", "profile.self.update")) is None


@pytest.mark.postgres
def test_audit_actor_delete_migration_preserves_history_and_allows_account_deletion(
    admin, db_engine
):
    from conftest import HEADERS
    from fastapi.testclient import TestClient
    from server.core.audit.models import AuditEvent
    from server.main import app
    from test_access import complete_password, issue, sign_in

    issued = issue(admin)
    user_id = UUID(issued["user"]["id"])
    # Nasimuluj původní FK bez ON DELETE, nikoli nové schéma z fixture.
    with db_engine.begin() as connection:
        for fk in inspect(connection).get_foreign_keys("audit_events"):
            if fk["constrained_columns"] == ["actor_user_id"]:
                name = connection.dialect.identifier_preparer.quote(fk["name"])
                connection.execute(
                    text(f"ALTER TABLE audit_events DROP CONSTRAINT {name}")
                )
        connection.execute(
            text(
                "ALTER TABLE audit_events ADD CONSTRAINT old_audit_actor_fk "
                "FOREIGN KEY (actor_user_id) REFERENCES users(id)"
            )
        )
        connection.execute(
            text(
                "DELETE FROM schema_migrations "
                "WHERE version = '20261023_04_audit_actor_delete'"
            )
        )
    with TestClient(app, headers=HEADERS) as user:
        sign_in(user, issued)
        complete_password(user, issued)
    with Session(db_engine) as db:
        event = db.exec(
            select(AuditEvent).where(AuditEvent.actor_user_id == user_id)
        ).one()
        event_id = event.id
    migrate(db_engine)
    migrate(db_engine)
    foreign_keys = inspect(db_engine).get_foreign_keys("audit_events")
    assert any(
        fk["constrained_columns"] == ["actor_user_id"]
        and fk["options"].get("ondelete") == "SET NULL"
        for fk in foreign_keys
    )
    response = admin.delete(f"/api/v1/admin/users/{user_id}")
    assert response.status_code == 204, response.text
    with Session(db_engine) as db:
        event = db.get(AuditEvent, event_id)
        assert event is not None and event.actor_user_id is None
