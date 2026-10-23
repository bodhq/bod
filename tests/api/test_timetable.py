from fastapi.testclient import TestClient
from server.core.access.models import UserRole
from server.core.security import get_password_hash
from server.core.users.models import User
from server.modules.timetable.models import Lesson
from sqlmodel import Session


def sign_in(client: TestClient, session: Session) -> None:
    user = User(
        username="student",
        hashed_password=get_password_hash("TestHeslo123456"),
        must_change_password=False,
    )
    session.add(user)
    session.commit()
    session.add(UserRole(user_id=user.id, role_code="student"))
    session.commit()
    response = client.post(
        "/api/v1/auth/login",
        json={"username": user.username, "password": "TestHeslo123456"},
    )
    assert response.status_code == 200


def test_get_timetable_for_class_success(client: TestClient, session: Session):
    sign_in(client, session)
    # --- ARRANGE ---
    # Testovací hodina v izolované SQLite databázi
    lesson = Lesson(
        class_id=1,
        subject="Matematika",
        teacher_id=1,
        room="A1",
        day=1,
        start_time="08:00",
        end_time="08:45",
    )
    session.add(lesson)
    session.commit()

    # --- ACT ---
    # Odeslání HTTP GET požadavku na naše API
    response = client.get("/api/v1/timetable/1")

    # --- ASSERT ---
    # Ověření, že vše dopadlo tak, jak má
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["subject"] == "Matematika"
    assert data[0]["room"] == "A1"


def test_get_timetable_for_class_not_found(client: TestClient, session: Session):
    sign_in(client, session)
    # --- ARRANGE ---
    # Nic nevytváříme, zkoušíme třídu bez rozvrhu

    # --- ACT ---
    response = client.get("/api/v1/timetable/999")

    # --- ASSERT ---
    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "RESOURCE_NOT_FOUND",
            "message": "Rozvrh nebyl nalezen.",
        }
    }


def test_timetable_requires_authentication(client: TestClient):
    assert client.get("/api/v1/timetable/1").status_code == 401
