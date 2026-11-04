from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from server.core.access.models import UserRole
from server.core.auth.models import AuthSession
from server.core.auth.repository import AuthSessionRepository
from server.core.auth.service import SessionCleanupService, utcnow
from server.core.config import settings
from server.core.security import get_password_hash, hash_session_token
from server.core.users.models import User
from sqlmodel import Session, select


def create_user(
    db: Session,
    *,
    username: str = "admin_bod",
    password: str = "TestovaciHeslo123",
    is_active: bool = True,
) -> User:
    user = User(
        username=username,
        hashed_password=get_password_hash(password),
        must_change_password=False,
        is_active=is_active,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    db.add(UserRole(user_id=user.id, role_code="admin"))
    db.commit()

    return user


def login(client: TestClient, username: str, password: str):
    return client.post(
        "/api/v1/auth/login",
        json={
            "username": username,
            "password": password,
        },
    )


def test_login_creates_hashed_database_session(
    client: TestClient,
    db: Session,
) -> None:
    user = create_user(db)

    response = login(client, user.username, "TestovaciHeslo123")

    assert response.status_code == 200
    assert response.json()["username"] == user.username

    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie

    raw_token = client.cookies.get(settings.session_cookie_name)
    assert raw_token is not None

    auth_session = db.exec(select(AuthSession)).first()
    assert auth_session is not None
    assert auth_session.token_hash == hash_session_token(raw_token)
    assert auth_session.token_hash != raw_token


def test_me_returns_logged_in_user(
    client: TestClient,
    db: Session,
) -> None:
    user = create_user(db)

    login(client, user.username, "TestovaciHeslo123")

    response = client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert response.json()["id"] == str(user.id)
    assert response.json()["active_role"] == "admin"


def test_me_without_cookie_returns_401(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "AUTH_UNAUTHENTICATED",
            "message": "Authentication is required",
        }
    }


def test_login_rejects_wrong_password(
    client: TestClient,
    db: Session,
) -> None:
    user = create_user(db)

    response = login(client, user.username, "spatne-heslo")

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "AUTH_INVALID_CREDENTIALS",
            "message": "Invalid username or password",
        }
    }


def test_login_rejects_unknown_username(
    client: TestClient,
) -> None:
    response = login(
        client,
        "neexistuje_user",
        "TestovaciHeslo123",
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "AUTH_INVALID_CREDENTIALS",
            "message": "Invalid username or password",
        }
    }


def test_login_rejects_invalid_username_format(
    client: TestClient,
) -> None:
    response = login(
        client,
        "invalid username!",
        "TestovaciHeslo123",
    )

    assert response.status_code == 422


def test_login_locks_username_and_ip_after_five_failures(
    client: TestClient,
    db: Session,
) -> None:
    user = create_user(db)

    for _ in range(4):
        response = login(client, user.username, "spatne-heslo")
        assert response.status_code == 401

    locked_response = login(client, user.username, "spatne-heslo")

    assert locked_response.status_code == 429
    assert locked_response.json() == {
        "error": {
            "code": "AUTH_ACCOUNT_LOCKED",
            "message": "Too many login attempts. Try again later.",
        }
    }

    correct_password_response = login(
        client,
        user.username,
        "TestovaciHeslo123",
    )

    assert correct_password_response.status_code == 429


def test_login_limits_failed_requests_from_one_ip(
    client: TestClient,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "login_ip_max_failures", 21)
    for index in range(20):
        response = login(
            client,
            f"unknown_user_{index}",
            "TestovaciHeslo123",
        )
        assert response.status_code == 401

    limited_response = login(
        client,
        "unknown_user_21",
        "TestovaciHeslo123",
    )

    assert limited_response.status_code == 429


def test_inactive_user_cannot_use_existing_session(
    client: TestClient,
    db: Session,
) -> None:
    user = create_user(db)

    login(client, user.username, "TestovaciHeslo123")

    user.is_active = False
    db.add(user)
    db.commit()

    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    db.expire_all()
    assert db.exec(select(AuthSession)).first() is None


def test_expired_session_is_rejected_and_deleted(
    client: TestClient,
    db: Session,
) -> None:
    user = create_user(db)

    login(client, user.username, "TestovaciHeslo123")

    auth_session = db.exec(select(AuthSession)).first()
    assert auth_session is not None

    auth_session.expires_at = datetime.now(UTC) - timedelta(minutes=1)

    db.add(auth_session)
    db.commit()

    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    db.expire_all()
    assert db.exec(select(AuthSession)).first() is None


def test_near_expiry_session_is_refreshed(
    client: TestClient,
    db: Session,
) -> None:
    user = create_user(db)

    login(client, user.username, "TestovaciHeslo123")

    auth_session = db.exec(select(AuthSession)).first()
    assert auth_session is not None

    auth_session.expires_at = datetime.now(UTC) + timedelta(days=1)

    db.add(auth_session)
    db.commit()

    response = client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert "set-cookie" in response.headers

    db.refresh(auth_session)

    expires_at = auth_session.expires_at

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    assert expires_at > (datetime.now(UTC) + timedelta(days=6))


def test_logout_deletes_session_and_cookie_access(
    client: TestClient,
    db: Session,
) -> None:
    user = create_user(db)

    login(client, user.username, "TestovaciHeslo123")

    logout_response = client.post("/api/v1/auth/logout")

    assert logout_response.status_code == 204
    db.expire_all()
    assert db.exec(select(AuthSession)).first() is None

    me_response = client.get("/api/v1/auth/me")

    assert me_response.status_code == 401


def test_cleanup_deletes_only_expired_sessions(db: Session) -> None:
    user = create_user(db)
    expired_session = AuthSession(
        user_id=user.id,
        token_hash="expired-token",
        expires_at=utcnow() - timedelta(minutes=1),
    )
    active_session = AuthSession(
        user_id=user.id,
        token_hash="active-token",
        expires_at=utcnow() + timedelta(days=1),
    )

    db.add(expired_session)
    db.add(active_session)
    db.commit()

    cleanup_service = SessionCleanupService(AuthSessionRepository(db))

    deleted_count = cleanup_service.remove_expired_sessions()

    assert deleted_count == 1
    assert db.get(AuthSession, expired_session.id) is None
    assert db.get(AuthSession, active_session.id) is not None


def test_login_is_case_insensitive(client: TestClient, db: Session) -> None:
    user = create_user(db)

    response = login(
        client,
        user.username.upper(),
        "TestovaciHeslo123",
    )

    assert response.status_code == 200


def test_login_returns_structured_error(
    client: TestClient,
    db: Session,
) -> None:
    user = create_user(db)

    response = login(client, user.username, "spatne-heslo")

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "AUTH_INVALID_CREDENTIALS",
            "message": "Invalid username or password",
        }
    }


def test_sessions_list_and_revoke_only_own_session(client: TestClient, db: Session):
    user = create_user(db)
    login(client, user.username, "TestovaciHeslo123")
    sessions = client.get("/api/v1/auth/sessions")
    assert sessions.status_code == 200
    assert len(sessions.json()) == 1
    session_id = sessions.json()[0]["id"]
    from uuid import uuid4

    assert client.delete(f"/api/v1/auth/sessions/{uuid4()}").status_code == 404
    assert client.delete(f"/api/v1/auth/sessions/{session_id}").status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401


def test_own_sessions_are_available_before_and_after_password_change_without_role(
    admin,
):
    from .conftest import HEADERS
    from server.main import app
    from .test_access import complete_password, issue, sign_in

    issued = issue(admin, roles=["student", "parent"])
    with TestClient(app, headers=HEADERS) as user:
        sign_in(user, issued)
        assert user.get("/api/v1/auth/me").json()["active_role"] is None
        before = user.get("/api/v1/auth/sessions")
        assert before.status_code == 200, before.text
        assert len(before.json()) == 1
        previous_id = before.json()[0]["id"]
        complete_password(user, issued)
        sessions = user.get("/api/v1/auth/sessions")
        assert sessions.status_code == 200, sessions.text
        assert len(sessions.json()) == 1
        assert sessions.json()[0]["id"] != previous_id
        for session in sessions.json():
            assert "token_hash" not in session
        # Vlastní relace jsou přístupné i s rolí bez oprávnění profilu.
        assert (
            admin.put(
                "/api/v1/admin/roles/student",
                json={"name": "Žák", "permission_codes": []},
            ).status_code
            == 200
        )
        assert (
            user.put(
                "/api/v1/auth/active-role", json={"role_code": "student"}
            ).status_code
            == 200
        )
        assert len(user.get("/api/v1/auth/sessions").json()) == 1
        root_session = admin.get("/api/v1/auth/sessions").json()[0]["id"]
        assert user.delete(f"/api/v1/auth/sessions/{root_session}").status_code == 404
        current_id = sessions.json()[0]["id"]
        assert user.delete(f"/api/v1/auth/sessions/{current_id}").status_code == 204
        assert user.get("/api/v1/auth/me").status_code == 401


def test_many_accounts_can_login_from_shared_school_ip(client, db):
    # Exceeds the previous request limit, without counting successful logins.
    password_hash = get_password_hash("TestovaciHeslo123")
    for index in range(25):
        db.add(User(username=f"school_{index}", hashed_password=password_hash))
    db.commit()
    for index in range(25):
        response = login(client, f"school_{index}", "TestovaciHeslo123")
        assert response.status_code == 200, response.text


def test_successful_login_does_not_reset_ip_failures(client, db, monkeypatch):
    monkeypatch.setattr(settings, "login_ip_max_failures", 3)
    user = create_user(db)
    assert login(client, "unknown_one", "wrong").status_code == 401
    assert login(client, user.username, "TestovaciHeslo123").status_code == 200
    assert login(client, "unknown_two", "wrong").status_code == 401
    assert login(client, "unknown_three", "wrong").status_code == 429
    assert login(client, user.username, "TestovaciHeslo123").status_code == 429


def test_sessions_identify_current_session_with_identical_user_agents(client, db):
    user = create_user(db)
    assert login(client, user.username, "TestovaciHeslo123").status_code == 200
    first_token = client.cookies.get(settings.session_cookie_name)
    assert login(client, user.username, "TestovaciHeslo123").status_code == 200
    second_token = client.cookies.get(settings.session_cookie_name)
    for token in (first_token, second_token):
        client.cookies.set(settings.session_cookie_name, token)
        response = client.get("/api/v1/auth/sessions")
        assert response.status_code == 200
        sessions = response.json()
        assert len(sessions) == 2
        assert sessions[0]["user_agent"] == sessions[1]["user_agent"]
        current = [s for s in sessions if s["is_current"]]
        assert len(current) == 1
        expected = db.exec(
            select(AuthSession).where(
                AuthSession.token_hash == hash_session_token(token)
            )
        ).one()
        assert current[0]["id"] == str(expected.id)
        assert all("token_hash" not in s and "token" not in s for s in sessions)


def test_ssr_preserves_expiry_until_browser_renews_database_and_cookie(
    client, db, monkeypatch
):
    from server.core.auth.service import as_utc

    user = create_user(db)
    login(client, user.username, "TestovaciHeslo123")
    session = db.exec(select(AuthSession)).one()
    now = datetime.now(UTC)
    expires = now + timedelta(hours=1)
    session.expires_at = expires
    db.commit()
    monkeypatch.setattr("server.core.auth.service.utcnow", lambda: now)

    ssr = client.get("/api/v1/auth/me", headers={"X-Session-Refresh": "skip"})
    assert ssr.status_code == 200
    assert "set-cookie" not in ssr.headers
    db.refresh(session)
    assert as_utc(session.expires_at) == expires

    browser = client.get("/api/v1/auth/me")
    assert browser.status_code == 200
    cookie_age = settings.session_idle_days * 86400
    assert f"Max-Age={cookie_age}" in browser.headers["set-cookie"]
    db.refresh(session)
    assert as_utc(session.expires_at) == now + timedelta(seconds=cookie_age)


def test_activity_is_updated_without_refresh_and_throttled(client, db, monkeypatch):
    from server.core.auth.service import as_utc

    user = create_user(db)
    login(client, user.username, "TestovaciHeslo123")
    session = db.exec(select(AuthSession)).one()
    now = datetime.now(UTC)
    session.last_seen_at = now - timedelta(
        seconds=settings.session_activity_interval_seconds
    )
    expires = as_utc(session.expires_at)
    db.commit()
    monkeypatch.setattr("server.core.auth.service.utcnow", lambda: now)
    first = client.get("/api/v1/auth/me")
    assert first.status_code == 200
    assert "set-cookie" not in first.headers
    db.refresh(session)
    assert as_utc(session.last_seen_at) == now
    assert as_utc(session.expires_at) == expires
    monkeypatch.setattr(
        "server.core.auth.service.utcnow", lambda: now + timedelta(seconds=1)
    )
    assert client.get("/api/v1/auth/me").status_code == 200
    db.refresh(session)
    assert as_utc(session.last_seen_at) == now


def test_ssr_cannot_extend_an_expired_session(client, db):
    client.headers["X-Session-Refresh"] = "skip"
    test_expired_session_is_rejected_and_deleted(client, db)
