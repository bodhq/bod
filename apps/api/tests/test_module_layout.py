from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlmodel import Session, select

from server.core.access.models import RolePermission
from server.core.domain.migration import migrate_rooms_permission
from server.core.migrations import migrate
from server.core.users.models import User
from server.main import app
from server.modules.timetable import models, schemas
from server.scripts import seed


def test_active_roles_apply_to_canonical_schedule(admin):
    response = admin.post(
        "/api/v1/admin/users",
        json={
            "username": "two.roles",
            "role_codes": ["teacher", "parent"],
        },
    )
    assert response.status_code == 201
    issued = response.json()
    assert (
        admin.put(
            "/api/v1/admin/roles/parent",
            json={
                "name": "Rodič",
                "permission_codes": ["profile.self.read"],
            },
        ).status_code
        == 200
    )
    with (
        TestClient(app, headers={"X-Requested-With": "bod"}) as teacher,
        TestClient(app, headers={"X-Requested-With": "bod"}) as parent,
    ):
        assert (
            teacher.post(
                "/api/v1/auth/login",
                json={
                    "username": "two.roles",
                    "password": issued["temporary_password"],
                },
            ).status_code
            == 200
        )
        new_password = "NewPasswordForRoles2026!"
        assert (
            teacher.post(
                "/api/v1/auth/change-password",
                json={
                    "current_password": issued["temporary_password"],
                    "new_password": new_password,
                },
            ).status_code
            == 200
        )
        assert (
            teacher.put(
                "/api/v1/auth/active-role", json={"role_code": "teacher"}
            ).status_code
            == 200
        )
        assert (
            parent.post(
                "/api/v1/auth/login",
                json={
                    "username": "two.roles",
                    "password": new_password,
                },
            ).status_code
            == 200
        )
        assert (
            parent.put(
                "/api/v1/auth/active-role", json={"role_code": "parent"}
            ).status_code
            == 200
        )
        path = "/api/v1/timetable/schedule?date_from=2026-09-01&date_to=2026-09-02"
        assert parent.get(path).status_code == 403
        assert teacher.get(path).status_code == 200
        assert teacher.get(path).json() == []
        assert (
            parent.patch("/api/v1/users/me", json={"phone": "123"}).status_code == 403
        )
        assert (
            teacher.patch("/api/v1/users/me", json={"phone": "123"}).status_code == 200
        )


def test_only_canonical_timetable_contract_is_registered(client):
    assert not hasattr(models, "Lesson")
    assert not hasattr(schemas, "LessonCreate")
    paths = app.openapi()["paths"]
    assert "/api/v1/timetable/{class_id}" not in paths
    assert "/api/v1/timetable/schedule" in paths
    assert "/api/v1/rooms" in paths
    assert not any("/facilities" in path for path in paths)
    assert client.get("/api/v1/timetable/1").status_code == 404
    module = Path(models.__file__).parent
    assert not list(module.glob("er_*.py"))


def test_rooms_collection_and_static_subroutes(api):
    response = api.post(
        "/api/v1/rooms/room-types", json={"code": "classroom", "name": "Učebna"}
    )
    assert response.status_code == 201, response.text
    response = api.post(
        "/api/v1/rooms",
        json={"code": "A1", "room_type_code": "classroom", "capacity": 30},
    )
    assert response.status_code == 201, response.text
    room_id = response.json()["id"]
    assert api.get("/api/v1/rooms").json()[0]["id"] == room_id
    assert api.get("/api/v1/rooms/" + room_id).status_code == 200
    for path in (
        "room-types",
        "group-home-rooms",
        "room-distance-models",
        "room-connections",
        "room-unavailability",
    ):
        assert api.get("/api/v1/rooms/" + path).status_code == 200
    assert (
        api.patch("/api/v1/rooms/" + room_id, json={"capacity": 31}).status_code == 200
    )
    assert api.delete("/api/v1/rooms/" + room_id).status_code == 204


def test_seed_initializes_access_without_prototype_tables(engine, monkeypatch):
    monkeypatch.setattr(seed, "engine", engine)
    monkeypatch.setattr(seed, "init_db", lambda: None)
    seed.seed_db()
    seed.seed_db()
    with Session(engine) as db:
        assert len(db.exec(select(User)).all()) == 1
        assert db.exec(select(User)).one().must_change_password
    assert "lesson" not in inspect(engine).get_table_names()


@pytest.mark.postgres
def test_rooms_permission_migration_preserves_existing_grants(engine):
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO roles (code,name) "
                "VALUES ('building_manager','Building manager')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO permissions (code,description) "
                "VALUES ('facilities.manage','Previous room permission')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO role_permissions (role_code,permission_code) "
                "VALUES ('building_manager','facilities.manage')"
            )
        )
        connection.execute(
            text(
                "DELETE FROM schema_migrations "
                "WHERE version='20261102_06_rooms_permission'"
            )
        )
    migrate(engine)
    migrate(engine)
    with Session(engine) as db:
        assert db.get(RolePermission, ("building_manager", "rooms.manage")) is not None
    with engine.connect() as connection:
        assert not connection.execute(
            text("SELECT 1 FROM permissions WHERE code='facilities.manage'")
        ).first()
    # The individual upgrade also remains harmless after a completed migration.
    with engine.begin() as connection:
        migrate_rooms_permission(connection)
