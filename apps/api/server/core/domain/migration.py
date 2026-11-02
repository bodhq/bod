"""Versioned PostgreSQL DDL for the school ER model, without data deletion."""

from pathlib import Path

from sqlalchemy import Connection, inspect, text
from sqlmodel import Session, SQLModel

from server.core.access.repository import AccessRepository
from server.core.access.services import AccessService


def migrate_er(connection: Connection) -> None:
    # Imported by database.py before migration; keep all existing core/legacy data.
    SQLModel.metadata.create_all(connection)
    # Bring existing core tables in line with the ER defaults as well.
    for statement in (
        "ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid(), "
        "ALTER COLUMN is_active SET DEFAULT true, "
        "ALTER COLUMN must_change_password SET DEFAULT true, "
        "ALTER COLUMN created_at SET DEFAULT now(), "
        "ALTER COLUMN updated_at SET DEFAULT now()",
        "ALTER TABLE auth_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid(), "
        "ALTER COLUMN created_at SET DEFAULT now(), "
        "ALTER COLUMN last_seen_at SET DEFAULT now()",
        "ALTER TABLE audit_events ALTER COLUMN id SET DEFAULT gen_random_uuid(), "
        "ALTER COLUMN created_at SET DEFAULT now()",
    ):
        connection.execute(text(statement))
    if not any(
        c["name"] == "auth_sessions_expiry_valid"
        for c in inspect(connection).get_check_constraints("auth_sessions")
    ):
        connection.execute(
            text(
                "ALTER TABLE auth_sessions ADD CONSTRAINT auth_sessions_expiry_valid "
                "CHECK (expires_at > created_at)"
            )
        )
    connection.execute(
        text("CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public")
    )
    statements = (
        "ALTER TABLE class_enrollments ADD CONSTRAINT ex_student_enrollment "
        "EXCLUDE USING gist (student_id WITH =, "
        "daterange(valid_from, valid_to, '[)') WITH &&)",
        "ALTER TABLE teaching_group_memberships ADD CONSTRAINT ex_group_membership "
        "EXCLUDE USING gist (group_id WITH =, student_id WITH =, "
        "daterange(valid_from, valid_to, '[)') WITH &&)",
        "ALTER TABLE school_years ADD CONSTRAINT ex_school_year "
        "EXCLUDE USING gist (daterange(starts_on, ends_on, '[)') WITH &&)",
        "ALTER TABLE time_slots ADD CONSTRAINT ex_time_slots "
        "EXCLUDE USING gist (time_grid_id WITH =, "
        "numrange(extract(epoch FROM start_time), "
        "extract(epoch FROM end_time), '[)') WITH &&)",
        "ALTER TABLE timetable_versions ADD CONSTRAINT ex_published_versions "
        "EXCLUDE USING gist (daterange(valid_from, valid_to, '[)') WITH &&) "
        "WHERE (status IN ('published', 'archived'))",
    )
    for statement in statements:
        connection.execute(text(statement))
    sql = Path(__file__).with_name("history.sql").read_text(encoding="utf-8")
    # psycopg handles the complete static DDL script, including function bodies.
    connection.execute(text(sql))
    with Session(bind=connection) as session:
        AccessService(AccessRepository(session)).seed_catalog()
        session.commit()


def migrate_rooms_permission(connection: Connection) -> None:
    """Preserve existing grants while renaming the rooms module permission."""
    for statement in (
        "INSERT INTO permissions (code,description) VALUES "
        "('rooms.manage','Spravovat místnosti a jejich dostupnost') "
        "ON CONFLICT (code) DO NOTHING",
        "INSERT INTO role_permissions (role_code,permission_code) "
        "SELECT role_code,'rooms.manage' FROM role_permissions "
        "WHERE permission_code='facilities.manage' ON CONFLICT DO NOTHING",
        "DELETE FROM role_permissions WHERE permission_code='facilities.manage'",
        "DELETE FROM permissions WHERE code='facilities.manage'",
    ):
        connection.execute(text(statement))
