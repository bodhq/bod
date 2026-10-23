from unittest.mock import patch

from fastapi.testclient import TestClient


def test_read_health_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_read_health_unhealthy(client: TestClient) -> None:
    with patch("server.main.engine") as mock_engine:
        mock_engine.connect.side_effect = Exception("DB down")
        response = client.get("/health")
        assert response.status_code == 503
        assert response.json()["status"] == "unhealthy"
