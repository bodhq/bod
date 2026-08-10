from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from server.core.database import get_session
from server.main import app


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_read_health_ok() -> None:
    """Health check vrátí 200 když je DB dostupná."""
    test_engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    with patch("server.main.engine", test_engine):
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


def test_read_health_unhealthy() -> None:
    """Health check vrátí 503 když DB není dostupná."""
    with patch("server.main.engine") as mock_engine:
        mock_engine.connect.side_effect = Exception("DB down")
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 503
        assert response.json()["status"] == "unhealthy"

