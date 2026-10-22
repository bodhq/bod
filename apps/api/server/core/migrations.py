"""Jednorázový, transakční převod původního auth schématu na RBAC.

Žádné drop_all ani přepis hesel. Verze je evidována ve stejném schématu jako data.
Další změny schématu musí dostat vlastní migraci (ne pouhé create_all).
"""

from sqlalchemy import Connection, Engine, inspect, text
from sqlmodel import Session, SQLModel

from server.core.access.repository import AccessRepository
from server.core.access.services import AccessService

VERSION = "20261022_01_access"


def migrate(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(text("SELECT pg_advisory_xact_lock(7463812041)"))
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS schema_migrations "
                "(version varchar(100) PRIMARY KEY, applied_at timestamptz "
                "NOT NULL DEFAULT CURRENT_TIMESTAMP)"
            )
        )
        for version, upgrade in (
            (VERSION, _migrate_access),
            ("20261022_02_user_avatars", _migrate_avatars),
            ("20261022_03_avatar_urls", _migrate_avatar_urls),
        ):
            applied = connection.execute(
                text("SELECT 1 FROM schema_migrations WHERE version = :version"),
                {"version": version},
            ).scalar()
            if not applied:
                upgrade(connection)
                connection.execute(
                    text("INSERT INTO schema_migrations (version) VALUES (:version)"),
                    {"version": version},
                )


def _migrate_avatars(connection: Connection) -> None:
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_key varchar(64)")
    )


def _migrate_avatar_urls(connection: Connection) -> None:
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url varchar(512)")
    )
    columns = {column["name"] for column in inspect(connection).get_columns("users")}
    if "avatar_key" not in columns:
        return
    invalid = connection.execute(
        text(
            "SELECT 1 FROM users WHERE avatar_key IS NOT NULL "
            "AND avatar_key !~ '^[0-9a-f]{32}[.]png$' LIMIT 1"
        )
    ).first()
    if invalid:
        raise RuntimeError("Původní profilová fotka obsahuje neplatný klíč.")
    conflict = connection.execute(
        text(
            "SELECT 1 FROM users WHERE avatar_key IS NOT NULL "
            "AND avatar_url IS NOT NULL AND avatar_url <> "
            "'/api/v1/users/' || id::text || '/avatar/' || avatar_key "
            "LIMIT 1"
        )
    ).first()
    if conflict:
        raise RuntimeError("URL profilové fotky neodpovídá původnímu klíči.")
    connection.execute(
        text(
            "UPDATE users SET avatar_url = '/api/v1/users/' || id::text || '/avatar/' "
            "|| avatar_key WHERE avatar_key IS NOT NULL AND avatar_url IS NULL"
        )
    )
    connection.execute(text("ALTER TABLE users DROP COLUMN avatar_key"))


def _migrate_access(connection: Connection) -> None:
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    legacy_role = False
    if "users" in tables:
        columns = {column["name"] for column in inspector.get_columns("users")}
        legacy_role = "role" in columns
        if "must_change_password" not in columns:
            # Stávající účty si ponechávají své heslo bez nuceného resetu.
            connection.execute(
                text(
                    "ALTER TABLE users ADD COLUMN must_change_password "
                    "boolean NOT NULL DEFAULT false"
                )
            )
        for name, definition in {
            "first_name": "varchar(100)",
            "last_name": "varchar(100)",
            "display_name": "varchar(100)",
            "email": "varchar(254)",
            "phone": "varchar(32)",
            "created_at": "timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP",
            "updated_at": "timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP",
        }.items():
            if name not in columns:
                # Názvy a typy jsou pevné konstanty, nikoliv vstup uživatele.
                connection.execute(
                    text(f'ALTER TABLE users ADD COLUMN "{name}" {definition}')
                )
        collision = connection.execute(
            text(
                "SELECT lower(btrim(username)) FROM users "
                "GROUP BY lower(btrim(username)) HAVING count(*) > 1 LIMIT 1"
            )
        ).first()
        if collision:
            raise RuntimeError("Uživatelé mají kolidující přihlašovací jména.")
        connection.execute(text("UPDATE users SET username = lower(btrim(username))"))
        # Nové účty mají dočasné heslo; převedené účty si ponechávají své heslo.
        connection.execute(
            text("ALTER TABLE users ALTER COLUMN must_change_password DROP DEFAULT")
        )

    if "auth_sessions" in tables:
        session_columns = {
            column["name"]: column for column in inspector.get_columns("auth_sessions")
        }
        if "active_role_code" not in session_columns:
            connection.execute(
                text(
                    "ALTER TABLE auth_sessions ADD COLUMN active_role_code varchar(64)"
                )
            )
        for name in ("created_at", "last_seen_at", "expires_at"):
            if not getattr(session_columns[name]["type"], "timezone", False):
                connection.execute(
                    text(
                        f'ALTER TABLE auth_sessions ALTER COLUMN "{name}" '
                        f"TYPE timestamptz USING \"{name}\" AT TIME ZONE 'UTC'"
                    )
                )

    SQLModel.metadata.create_all(connection)
    with Session(bind=connection) as session:
        AccessService(AccessRepository(session)).seed_catalog()
        session.commit()

    if legacy_role:
        invalid = connection.execute(
            text(
                "SELECT 1 FROM users WHERE lower(role::text) NOT IN "
                "('student', 'teacher', 'parent', 'admin') LIMIT 1"
            )
        ).first()
        if invalid:
            raise RuntimeError("Původní účet obsahuje neznámou roli.")
        connection.execute(
            text(
                "INSERT INTO user_roles (user_id, role_code) "
                "SELECT id, lower(role::text) FROM users ON CONFLICT DO NOTHING"
            )
        )
        connection.execute(
            text(
                "UPDATE auth_sessions s SET active_role_code = lower(u.role::text) "
                "FROM users u WHERE u.id = s.user_id"
            )
        )
        connection.execute(text("ALTER TABLE users DROP COLUMN role"))

    if "auth_sessions" in tables:
        constraints = inspect(connection).get_foreign_keys("auth_sessions")
        if not any(
            fk["constrained_columns"] == ["user_id", "active_role_code"]
            for fk in constraints
        ):
            connection.execute(
                text(
                    "ALTER TABLE auth_sessions "
                    "ADD CONSTRAINT fk_auth_session_active_role "
                    "FOREIGN KEY (user_id, active_role_code) "
                    "REFERENCES user_roles(user_id, role_code)"
                )
            )
