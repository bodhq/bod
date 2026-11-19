"""Add optional study fields and physical room layouts, preserving legacy data."""

from sqlalchemy import Connection, inspect, text
from sqlmodel import SQLModel


def migrate_school_layout(connection: Connection) -> None:
    for name in (
        "study_fields",
        "group_study_field_rules",
        "buildings",
        "building_floors",
    ):
        SQLModel.metadata.tables[name].create(connection, checkfirst=True)
    for statement in (
        "ALTER TABLE specializations ADD COLUMN IF NOT EXISTS "
        "study_field_id uuid REFERENCES study_fields(id)",
        "CREATE INDEX IF NOT EXISTS ix_specializations_study_field_id "
        "ON specializations (study_field_id)",
        "ALTER TABLE class_enrollments ADD COLUMN IF NOT EXISTS "
        "study_field_id uuid REFERENCES study_fields(id)",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS "
        "floor_id uuid REFERENCES building_floors(id)",
        "CREATE INDEX IF NOT EXISTS ix_rooms_floor_id ON rooms (floor_id)",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS x integer, "
        "ADD COLUMN IF NOT EXISTS y integer, "
        "ADD COLUMN IF NOT EXISTS width integer, "
        "ADD COLUMN IF NOT EXISTS height integer",
        "ALTER TABLE timetable_versions ALTER COLUMN distance_model_id DROP NOT NULL",
        "ALTER TABLE group_divisions DROP CONSTRAINT IF EXISTS "
        "ck_group_divisions_method",
        "ALTER TABLE group_divisions ADD CONSTRAINT ck_group_divisions_method "
        "CHECK (method IN ('alphabetical', 'study_field', 'specialization', 'manual'))",
    ):
        connection.execute(text(statement))
    if not any(
        check["name"] == "rooms_layout_valid"
        for check in inspect(connection).get_check_constraints("rooms")
    ):
        connection.execute(
            text(
                "ALTER TABLE rooms ADD CONSTRAINT rooms_layout_valid CHECK ("
                "(x IS NULL AND y IS NULL AND width IS NULL AND height IS NULL) OR "
                "(floor_id IS NOT NULL AND x IS NOT NULL AND y IS NOT NULL "
                "AND width IS NOT NULL AND height IS NOT NULL "
                "AND x >= 0 AND y >= 0 AND width > 0 AND height > 0))"
            )
        )
