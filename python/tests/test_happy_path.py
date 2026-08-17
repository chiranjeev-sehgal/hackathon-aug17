from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Isolate test data before importing the app
_tmp = tempfile.mkdtemp(prefix="ai-support-py-")
os.environ["DATA_DIR"] = _tmp

from app.db.json_db import clear_all  # noqa: E402
from app.main import create_app  # noqa: E402
from app.store import seed_users  # noqa: E402


@pytest.fixture(scope="module")
def client():
    clear_all()
    seed_users()
    app = create_app()
    with TestClient(app) as c:
        yield c


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_seed_users_can_login(client):
    for username, password in [
        ("admin", "admin123"),
        ("emp", "emp123"),
        ("guest", "guest123"),
    ]:
        res = client.post("/auth/login", json={"username": username, "password": password})
        assert res.status_code == 200
        data = res.json()
        assert data["access_token"]
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 900


def test_register_assigns_employee(client):
    username = f"user_{Path(_tmp).name}"
    res = client.post(
        "/auth/register",
        json={"username": username, "password": "secret12", "role": "Admin"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["username"] == username
    assert data["role"] == "Employee"


def test_employee_chat_contract(client):
    login = client.post("/auth/login", json={"username": "emp", "password": "emp123"})
    token = login.json()["access_token"]
    res = client.post(
        "/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "How many days of annual leave do employees accrue?"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["conversation_id"]
    assert isinstance(data["answer"], str)
    assert isinstance(data["sources"], list)
    assert isinstance(data["confidence"], (int, float))
    assert "tokens" in data
    assert isinstance(data["cost_usd"], (int, float))
    assert isinstance(data["latency_ms"], (int, float))


def test_employee_history(client):
    login = client.post("/auth/login", json={"username": "emp", "password": "emp123"})
    token = login.json()["access_token"]
    chat = client.post(
        "/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Remind me about onboarding buddy assignment."},
    )
    conv_id = chat.json()["conversation_id"]
    hist = client.get(
        f"/chat/history?conversation_id={conv_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert hist.status_code == 200
    data = hist.json()
    assert data["conversation_id"] == conv_id
    assert len(data["messages"]) >= 2
