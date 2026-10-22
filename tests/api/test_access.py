from uuid import UUID

from conftest import HEADERS
from fastapi.testclient import TestClient
from server.core.access.repository import AccessRepository
from server.core.access.services import AccessService
from server.core.audit.models import AuditEvent
from server.core.config import settings
from server.core.users.models import User
from server.main import app
from sqlalchemy import Column, ForeignKey, Integer, MetaData, Table, Uuid, insert
from sqlmodel import Session, select


def issue(admin, username="test.user", roles=None):
    response = admin.post(
        "/api/v1/admin/users",
        json={"username": username, "role_codes": roles or ["student"]},
    )
    assert response.status_code == 201, response.text
    return response.json()


def sign_in(client, issued):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": issued["user"]["username"],
            "password": issued["temporary_password"],
        },
    )
    assert response.status_code == 200, response.text
    return response


def complete_password(client, issued):
    response = client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": issued["temporary_password"],
            "new_password": "NoveHesloProStudenta2026!",
        },
    )
    assert response.status_code == 200, response.text
    return response


def test_bootstrap_idempotent(root_credentials, db_engine):
    assert root_credentials.user.username == "root"
    assert root_credentials.user.must_change_password
    with Session(db_engine) as db:
        assert AccessService(AccessRepository(db)).bootstrap() is None
        assert len(db.exec(select(User)).all()) == 1


def test_default_admin_must_change_password(client, root_credentials):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "root", "password": root_credentials.temporary_password},
    )
    assert response.status_code == 200
    assert response.json()["permissions"] == []
    response = client.get("/api/v1/admin/users")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "AUTH_PASSWORD_CHANGE_REQUIRED"


def test_wrong_login_and_missing_login(client, root_credentials):
    assert client.get("/api/v1/admin/users").status_code == 401
    assert (
        client.post(
            "/api/v1/auth/login", json={"username": "root", "password": "wrong"}
        ).status_code
        == 401
    )


def test_create_generates_hash_and_no_password_in_audit(admin, db_engine):
    issued = issue(admin)
    assert len(issued["temporary_password"]) >= 24
    assert issued["user"]["first_name"] is None
    with Session(db_engine) as db:
        user = db.exec(select(User).where(User.username == "test.user")).one()
        assert user.hashed_password.startswith("$argon2id$")
        assert issued["temporary_password"] != user.hashed_password
        audits = db.exec(select(AuditEvent)).all()
        assert issued["temporary_password"] not in str(
            [audit.model_dump() for audit in audits]
        )
    data = admin.get("/api/v1/admin/users").json()
    assert all(
        "hashed_password" not in user and "temporary_password" not in user
        for user in data
    )


def test_batch_generation_and_atomic_conflict(admin, db_engine):
    response = admin.post(
        "/api/v1/admin/users/generate",
        json={"users": [{"role_codes": ["student"]}, {"role_codes": ["parent"]}]},
    )
    assert response.status_code == 201
    assert len({item["user"]["username"] for item in response.json()}) == 2
    issue(admin, "existing")
    response = admin.post(
        "/api/v1/admin/users/generate",
        json={
            "users": [
                {"username": "should.rollback", "role_codes": ["student"]},
                {"username": "existing", "role_codes": ["student"]},
            ]
        },
    )
    assert response.status_code == 409
    with Session(db_engine) as db:
        assert (
            db.exec(select(User).where(User.username == "should.rollback")).first()
            is None
        )


def test_student_cannot_manage_accounts(admin):
    issued = issue(admin)
    with TestClient(app, headers=HEADERS) as user:
        sign_in(user, issued)
        complete_password(user, issued)
        assert user.get("/api/v1/admin/users").status_code == 403
        assert (
            user.post(
                "/api/v1/admin/users",
                json={"username": "attacker", "role_codes": ["admin"]},
            ).status_code
            == 403
        )


def test_active_role_and_own_profile(admin):
    issued = issue(admin, roles=["teacher", "parent"])
    with TestClient(app, headers=HEADERS) as user:
        assert sign_in(user, issued).json()["active_role"] is None
        complete_password(user, issued)
        assert (
            user.put(
                "/api/v1/auth/active-role", json={"role_code": "admin"}
            ).status_code
            == 403
        )
        assert (
            user.put(
                "/api/v1/auth/active-role", json={"role_code": "parent"}
            ).status_code
            == 200
        )
        response = user.patch(
            "/api/v1/users/me", json={"first_name": " Jan ", "last_name": "Novák"}
        )
        assert response.status_code == 200
        assert response.json()["first_name"] == "Jan"
        assert (
            user.patch("/api/v1/users/me", json={"role_codes": ["admin"]}).status_code
            == 422
        )


def test_role_permissions_and_revocation(admin):
    issued = issue(admin, roles=["teacher", "parent"])
    with TestClient(app, headers=HEADERS) as user:
        sign_in(user, issued)
        complete_password(user, issued)
        assert (
            user.put(
                "/api/v1/auth/active-role", json={"role_code": "teacher"}
            ).status_code
            == 200
        )
        response = admin.put(
            "/api/v1/admin/roles/teacher",
            json={"name": "Učitel", "permission_codes": ["timetable.read"]},
        )
        assert response.status_code == 200, response.text
        assert (
            user.patch("/api/v1/users/me", json={"first_name": "Denied"}).status_code
            == 403
        )
        response = admin.patch(
            "/api/v1/admin/users/" + issued["user"]["id"],
            json={"role_codes": ["parent"]},
        )
        assert response.status_code == 200, response.text
        assert user.get("/api/v1/auth/me").json()["active_role"] is None
        assert (
            user.put(
                "/api/v1/auth/active-role", json={"role_code": "teacher"}
            ).status_code
            == 403
        )


def test_reset_password_revokes_existing_sessions(admin):
    issued = issue(admin)
    with TestClient(app, headers=HEADERS) as user:
        sign_in(user, issued)
        complete_password(user, issued)
        response = admin.post(
            "/api/v1/admin/users/" + issued["user"]["id"] + "/reset-password"
        )
        assert response.status_code == 200
        assert user.get("/api/v1/auth/me").status_code == 401
        assert (
            user.post(
                "/api/v1/auth/login",
                json={"username": "test.user", "password": "NoveHesloProStudenta2026!"},
            ).status_code
            == 401
        )
        sign_in(user, response.json())
        assert user.patch("/api/v1/users/me", json={"phone": "123"}).status_code == 403


def test_deactivation_and_reactivation(admin):
    issued = issue(admin)
    with TestClient(app, headers=HEADERS) as user:
        sign_in(user, issued)
        complete_password(user, issued)
        assert (
            admin.patch(
                "/api/v1/admin/users/" + issued["user"]["id"], json={"is_active": False}
            ).status_code
            == 200
        )
        assert user.get("/api/v1/auth/me").status_code == 401
        assert (
            admin.patch(
                "/api/v1/admin/users/" + issued["user"]["id"], json={"is_active": True}
            ).status_code
            == 200
        )
        assert (
            user.post(
                "/api/v1/auth/login",
                json={"username": "test.user", "password": "NoveHesloProStudenta2026!"},
            ).status_code
            == 200
        )


def test_admin_separation_and_last_admin(admin):
    response = admin.post(
        "/api/v1/admin/users",
        json={"username": "mixed", "role_codes": ["admin", "teacher"]},
    )
    assert response.status_code == 422
    root = admin.get("/api/v1/auth/me").json()
    assert (
        admin.patch(
            "/api/v1/admin/users/" + root["id"], json={"is_active": False}
        ).status_code
        == 409
    )
    assert (
        admin.patch(
            "/api/v1/admin/users/" + root["id"], json={"role_codes": ["teacher"]}
        ).status_code
        == 409
    )
    assert admin.delete("/api/v1/admin/users/" + root["id"]).status_code == 409
    assert (
        admin.put(
            "/api/v1/admin/roles/admin", json={"name": "Admin", "permission_codes": []}
        ).status_code
        == 409
    )


def test_unused_user_can_be_deleted(admin):
    issued = issue(admin)
    assert (
        admin.delete("/api/v1/admin/users/" + issued["user"]["id"]).status_code == 204
    )
    assert admin.get("/api/v1/admin/users/" + issued["user"]["id"]).status_code == 404


def test_referenced_user_delete_is_atomic_conflict(admin, db_engine):
    issued = issue(admin)
    meta = MetaData()
    Table("users", meta, autoload_with=db_engine)
    reference = Table(
        "school_reference",
        meta,
        Column("id", Integer, primary_key=True),
        Column("user_id", Uuid(), ForeignKey("users.id"), nullable=False),
    )
    reference.create(db_engine)
    try:
        with db_engine.begin() as connection:
            connection.execute(
                insert(reference).values(user_id=UUID(issued["user"]["id"]))
            )
        assert (
            admin.delete("/api/v1/admin/users/" + issued["user"]["id"]).status_code
            == 409
        )
        assert admin.get("/api/v1/admin/users/" + issued["user"]["id"]).json()[
            "roles"
        ] == ["student"]
    finally:
        reference.drop(db_engine)


def test_custom_roles_and_technical_permissions(admin):
    assert (
        admin.post(
            "/api/v1/admin/roles",
            json={
                "code": "scheduler",
                "name": "Rozvrhář",
                "permission_codes": ["timetable.generate"],
            },
        ).status_code
        == 201
    )
    assert (
        admin.post(
            "/api/v1/admin/roles",
            json={
                "code": "fakeadmin",
                "name": "Fake",
                "permission_codes": ["users.manage"],
            },
        ).status_code
        == 422
    )
    assert (
        admin.post(
            "/api/v1/admin/roles",
            json={
                "code": "unknownperm",
                "name": "Bad",
                "permission_codes": ["unknown"],
            },
        ).status_code
        == 422
    )
    assert admin.delete("/api/v1/admin/roles/scheduler").status_code == 204


def test_csrf_header_and_origin(admin):
    response = admin.post(
        "/api/v1/admin/users",
        json={"username": "blocked"},
        headers={"X-Requested-With": "wrong"},
    )
    assert response.status_code == 403
    response = admin.post(
        "/api/v1/admin/users",
        json={"username": "blocked"},
        headers={"Origin": "https://untrusted.example"},
    )
    assert response.status_code == 403


def test_password_change_rotates_token(admin):
    before = admin.cookies.get(settings.session_cookie_name)
    response = admin.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": "NoveHesloProAdmina2026!",
            "new_password": "DruheNoveHesloProAdmina2026!",
        },
    )
    assert response.status_code == 200
    assert admin.cookies.get(settings.session_cookie_name) != before
    with TestClient(app, headers=HEADERS) as old:
        old.cookies.set(settings.session_cookie_name, before)
        assert old.get("/api/v1/auth/me").status_code == 401


def test_concurrent_bootstrap_creates_only_one_admin(db_engine):
    from concurrent.futures import ThreadPoolExecutor

    def initialize(_):
        with Session(db_engine) as db:
            return AccessService(AccessRepository(db)).bootstrap()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(initialize, range(2)))
    assert sum(result is not None for result in results) == 1
    with Session(db_engine) as db:
        assert len(db.exec(select(User)).all()) == 1


def test_concurrent_admin_deactivation_preserves_one_admin(admin):
    from concurrent.futures import ThreadPoolExecutor

    issued = issue(admin, username="second.admin", roles=["admin"])
    root_id = admin.get("/api/v1/auth/me").json()["id"]
    with TestClient(app, headers=HEADERS) as second:
        sign_in(second, issued)
        complete_password(second, issued)

        def deactivate(pair):
            client, user_id = pair
            return client.patch(
                "/api/v1/admin/users/" + user_id, json={"is_active": False}
            ).status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(
                pool.map(deactivate, [(admin, root_id), (second, issued["user"]["id"])])
            )
        assert sorted(statuses) == [200, 409]


def test_active_role_is_session_local_and_permissions_are_not_combined(admin):
    issued = issue(admin, roles=["teacher", "parent"])
    response = admin.put(
        "/api/v1/admin/roles/parent",
        json={"name": "Rodič", "permission_codes": ["profile.self.read"]},
    )
    assert response.status_code == 200
    with (
        TestClient(app, headers=HEADERS) as teacher,
        TestClient(app, headers=HEADERS) as parent,
    ):
        sign_in(teacher, issued)
        complete_password(teacher, issued)
        teacher.put("/api/v1/auth/active-role", json={"role_code": "teacher"})
        response = parent.post(
            "/api/v1/auth/login",
            json={
                "username": issued["user"]["username"],
                "password": "NoveHesloProStudenta2026!",
            },
        )
        assert response.status_code == 200
        parent.put("/api/v1/auth/active-role", json={"role_code": "parent"})
        assert parent.get("/api/v1/auth/me").json()["permissions"] == [
            "profile.self.read"
        ]
        assert teacher.get("/api/v1/auth/me").json()["active_role"] == "teacher"
        assert parent.get("/api/v1/timetable/1").status_code == 403
        assert teacher.get("/api/v1/timetable/1").status_code == 404
        assert (
            parent.patch("/api/v1/users/me", json={"phone": "123"}).status_code == 403
        )
        assert (
            teacher.patch("/api/v1/users/me", json={"phone": "123"}).status_code == 200
        )


def test_session_role_must_belong_to_that_user_in_database(admin, db_engine):
    from datetime import UTC, datetime, timedelta

    import pytest
    from server.core.auth.models import AuthSession
    from sqlalchemy.exc import IntegrityError

    issued = issue(admin)
    with Session(db_engine) as db:
        db.add(
            AuthSession(
                user_id=UUID(issued["user"]["id"]),
                token_hash="invalid-role",
                active_role_code="admin",
                expires_at=datetime.now(UTC) + timedelta(days=1),
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def test_temporary_password_cannot_be_used_for_normal_actions(client, root_credentials):
    sign_in(client, root_credentials.model_dump(mode="json"))
    assert client.get("/api/v1/auth/me").status_code == 200
    assert client.get("/api/v1/auth/sessions").status_code == 403
    assert (
        client.put("/api/v1/auth/active-role", json={"role_code": "admin"}).status_code
        == 403
    )
    assert client.post("/api/v1/auth/logout").status_code == 204


def test_password_change_rejects_wrong_or_unchanged_password(admin):
    assert (
        admin.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "not-the-password",
                "new_password": "NoveBezpecneHeslo123456!",
            },
        ).status_code
        == 401
    )
    assert (
        admin.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "NoveHesloProAdmina2026!",
                "new_password": "NoveHesloProAdmina2026!",
            },
        ).status_code
        == 422
    )


def test_admin_catalog_and_audit_have_typed_public_responses(admin):
    permissions = admin.get("/api/v1/admin/permissions")
    assert permissions.status_code == 200
    assert any(item["code"] == "users.manage" for item in permissions.json())
    roles = admin.get("/api/v1/admin/roles")
    assert roles.status_code == 200
    assert {item["code"] for item in roles.json()} == {
        "admin",
        "teacher",
        "parent",
        "student",
    }
    events = admin.get("/api/v1/admin/audit")
    assert events.status_code == 200
    assert any(item["event_code"] == "password.changed" for item in events.json())
    issued = issue(admin)
    assert (
        admin.patch(
            "/api/v1/admin/users/" + issued["user"]["id"], json={"role_codes": None}
        ).status_code
        == 422
    )


def test_audit_keeps_actor_role_when_admin_removes_own_role(admin, db_engine):
    issue(admin, username="second.admin", roles=["admin"])
    me = admin.get("/api/v1/auth/me").json()
    response = admin.patch(
        "/api/v1/admin/users/" + me["id"], json={"role_codes": ["teacher"]}
    )
    assert response.status_code == 200
    assert admin.get("/api/v1/admin/users").status_code == 403
    assert admin.get("/api/v1/auth/me").json()["active_role"] is None

    with Session(db_engine) as db:
        event = db.exec(
            select(AuditEvent).where(AuditEvent.event_code == "user.updated")
        ).one()
        assert str(event.actor_user_id) == me["id"]
        assert event.actor_role_code == "admin"


def test_existing_browser_can_login_with_allowed_origin_without_custom_header(
    client, root_credentials
):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": "root",
            "password": root_credentials.temporary_password,
        },
        headers={"Origin": "http://localhost:3000", "X-Requested-With": ""},
    )
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
