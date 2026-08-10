import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from server.core.database import get_session
from server.main import app
from server.modules.timetable.models import Lesson

"""
ONBOARDING PRO VÝVOJÁŘE:
Toto je testovací soubor využívající Pytest.

Pravidlo: Testy v enterprise repozitáři dodržují AAA vzor:
1. Arrange (Příprava dat)
2. Act (Zavolání funkce/API)
3. Assert (Ověření výsledku)

Zde používáme In-Memory SQLite databázi (`StaticPool`), abychom nešpinili 
skutečnou produkční nebo lokální PostgreSQL databázi během testování.
"""

# 1. ARRANGE: Příprava Testovací databáze
@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

# 2. ARRANGE: Override FastAPI závislostí
@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def test_get_timetable_for_class_success(client: TestClient, session: Session):
    # --- ARRANGE ---
    # Vytvoření testovací hodiny v naší dočasné in-memory databázi
    lesson = Lesson(
        class_id=1,
        subject="Matematika",
        teacher_id=1,
        room="A1",
        day=1,
        start_time="08:00",
        end_time="08:45"
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

def test_get_timetable_for_class_not_found(client: TestClient):
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
