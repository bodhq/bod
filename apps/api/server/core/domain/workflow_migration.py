"""Repair unbounded annual intervals without changing their effective meaning."""

from pathlib import Path

from sqlalchemy import Connection, text


def migrate_domain_locks(connection: Connection) -> None:
    # Keep the original migration reproducible. Existing installations receive
    # the new function through this explicit versioned migration.
    sql = Path(__file__).with_name("history.sql").read_text(encoding="utf-8")
    function = sql.split("DO $$", 1)[0].replace(
        "PERFORM pg_advisory_xact_lock(7463812041);",
        "PERFORM pg_advisory_xact_lock_shared(7463812041);\n"
        "    PERFORM pg_advisory_xact_lock(7463812042);",
    )
    connection.execute(text(function))


def migrate_role_scopes(connection: Connection) -> None:
    from server.core.access.models import RoleSchoolScope

    RoleSchoolScope.metadata.tables["role_school_scopes"].create(
        connection, checkfirst=True
    )
    connection.execute(
        text("DELETE FROM role_permissions WHERE permission_code='timetable.generate'")
    )
    connection.execute(text("DELETE FROM permissions WHERE code='timetable.generate'"))


def migrate_annual_intervals(connection: Connection) -> None:
    connection.execute(
        text(
            "UPDATE class_enrollments e SET valid_to = y.ends_on "
            "FROM classes c JOIN school_years y ON y.id = c.school_year_id "
            "WHERE e.class_id = c.id AND e.valid_to IS NULL"
        )
    )
    connection.execute(
        text(
            "UPDATE teaching_group_memberships m SET valid_to = y.ends_on "
            "FROM teaching_groups g JOIN school_years y ON y.id = g.school_year_id "
            "WHERE m.group_id = g.id AND m.valid_to IS NULL"
        )
    )
    # Migration holds the management lock; disabling this user trigger is scoped
    # to this transaction and only bounds the already year-limited resolution.
    connection.execute(
        text("ALTER TABLE timetable_versions DISABLE TRIGGER guard_er_history")
    )
    connection.execute(
        text(
            "UPDATE timetable_versions v SET valid_to = y.ends_on "
            "FROM teaching_plans p JOIN school_years y ON y.id = p.school_year_id "
            "WHERE v.teaching_plan_id = p.id AND v.valid_to IS NULL"
        )
    )
    connection.execute(
        text("ALTER TABLE timetable_versions ENABLE TRIGGER guard_er_history")
    )
