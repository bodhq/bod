from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from server.core.config import settings
from server.core.database import get_session
from server.core.security import get_password_hash, hash_session_token
from server.main import app
from server.core.auth.models import AuthSession
from server.core.users.models import Role, User


@pytest.fixture(name="db")
def db_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(db: Session):
    def get_session_override():
        yield db

    app.dependency_overrides[get_session] = get_session_override

    client = TestClient(app)
    yield client

    client.close()
    app.dependency_overrides.clear()


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
        role=Role.ADMIN,
        is_active=is_active,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

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
    assert response.json()["role"] == "admin"


def test_me_without_cookie_returns_401(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_login_rejects_wrong_password(
    client: TestClient,
    db: Session,
) -> None:
    user = create_user(db)

    response = login(client, user.username, "spatne-heslo")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Invalid username or password"
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
        "detail": "Invalid username or password"
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
    assert db.exec(select(AuthSession)).first() is None


def test_expired_session_is_rejected_and_deleted(
    client: TestClient,
    db: Session,
) -> None:
    user = create_user(db)

    login(client, user.username, "TestovaciHeslo123")

    auth_session = db.exec(select(AuthSession)).first()
    assert auth_session is not None

    auth_session.expires_at = (
        datetime.now(timezone.utc) - timedelta(minutes=1)
    )

    db.add(auth_session)
    db.commit()

    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert db.exec(select(AuthSession)).first() is None


def test_near_expiry_session_is_refreshed(
    client: TestClient,
    db: Session,
) -> None:
    user = create_user(db)

    login(client, user.username, "TestovaciHeslo123")

    auth_session = db.exec(select(AuthSession)).first()
    assert auth_session is not None

    auth_session.expires_at = (
        datetime.now(timezone.utc) + timedelta(days=1)
    )

    db.add(auth_session)
    db.commit()

    response = client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert "set-cookie" in response.headers

    db.refresh(auth_session)

    expires_at = auth_session.expires_at

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    assert expires_at > (
        datetime.now(timezone.utc) + timedelta(days=6)
    )


def test_logout_deletes_session_and_cookie_access(
    client: TestClient,
    db: Session,
) -> None:
    user = create_user(db)

    login(client, user.username, "TestovaciHeslo123")

    logout_response = client.post("/api/v1/auth/logout")

    assert logout_response.status_code == 204
    assert db.exec(select(AuthSession)).first() is None

    me_response = client.get("/api/v1/auth/me")

    assert me_response.status_code == 401
