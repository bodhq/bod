from fastapi.testclient import TestClient

from server.main import app

client = TestClient(app)

def test_read_health() -> None:
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
