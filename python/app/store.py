from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from passlib.context import CryptContext

from app.config import KB_DIR
from app.db import json_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_kb_docs: list[dict[str, Any]] = []


def load_knowledge_base() -> list[dict[str, Any]]:
    global _kb_docs
    docs = []
    for path in sorted(KB_DIR.glob("*.json")):
        docs.append(json.loads(path.read_text(encoding="utf-8")))
    _kb_docs = docs
    return _kb_docs


def get_knowledge_base() -> list[dict[str, Any]]:
    return _kb_docs


def get_doc_by_id(doc_id: str) -> dict[str, Any] | None:
    for doc in _kb_docs:
        if doc.get("doc_id") == doc_id:
            return doc
    return None


def seed_users() -> None:
    seeds = [
        {"username": "admin", "password": "admin123", "role": "Admin"},
        {"username": "emp", "password": "emp123", "role": "Employee"},
        {"username": "guest", "password": "guest123", "role": "Guest"},
    ]
    users = json_db.read_collection("users")
    changed = False
    for seed in seeds:
        if seed["username"] in users:
            continue
        users[seed["username"]] = {
            "id": f"user_{seed['username']}",
            "username": seed["username"],
            "password_hash": pwd_context.hash(seed["password"]),
            "role": seed["role"],
        }
        changed = True
    if changed:
        json_db.write_collection("users", users)


def find_user_by_username(username: str) -> dict[str, Any] | None:
    users = json_db.read_collection("users")
    return users.get(username)


def create_user(username: str, password_hash: str, role: str) -> dict[str, Any] | None:
    users = json_db.read_collection("users")
    if username in users:
        return None
    import time

    user = {
        "id": f"user_{username}_{int(time.time() * 1000)}",
        "username": username,
        "password_hash": password_hash,
        "role": role,
    }
    users[username] = user
    json_db.write_collection("users", users)
    return {"id": user["id"], "username": user["username"], "role": user["role"]}


def verify_password(plain: str, password_hash: str) -> bool:
    return pwd_context.verify(plain, password_hash)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def get_or_create_conversation(conversation_id: str | None, user_id: str) -> dict[str, Any]:
    conversations = json_db.read_collection("conversations")
    if conversation_id and conversation_id in conversations:
        conv = conversations[conversation_id]
        if conv.get("userId") == user_id:
            return conv

    import random
    import time

    cid = conversation_id or f"conv_{int(time.time() * 1000)}_{random.randrange(36**6):06x}"
    conv = {"id": cid, "userId": user_id, "messages": []}
    conversations[cid] = conv
    json_db.write_collection("conversations", conversations)
    return conv


def get_conversation(conversation_id: str, user_id: str) -> dict[str, Any] | None:
    conversations = json_db.read_collection("conversations")
    conv = conversations.get(conversation_id)
    if not conv or conv.get("userId") != user_id:
        return None
    return conv


def append_message(conversation_id: str, message: dict[str, Any]) -> None:
    def updater(conversations: dict[str, Any]) -> dict[str, Any]:
        conv = conversations.get(conversation_id)
        if not conv:
            return conversations
        conv["messages"].append(message)
        return conversations

    json_db.update_collection("conversations", updater)


def record_metrics(tokens: int, cost_usd: float, latency_ms: float) -> None:
    def updater(metrics: dict[str, Any]) -> dict[str, Any]:
        metrics["total_requests"] += 1
        metrics["total_tokens"] += tokens
        metrics["total_cost_usd"] += cost_usd
        metrics["latencies"].append(latency_ms)
        if len(metrics["latencies"]) > 10_000:
            metrics["latencies"] = metrics["latencies"][-5_000:]
        return metrics

    json_db.update_collection("metrics", updater)


def get_metrics_snapshot() -> dict[str, Any]:
    metrics = json_db.read_collection("metrics")
    latencies = sorted(metrics.get("latencies") or [])
    if not latencies:
        avg = 0.0
        p95 = 0.0
    else:
        avg = sum(latencies) / len(latencies)
        p95 = latencies[min(len(latencies) - 1, int(len(latencies) * 0.95))]
    return {
        "total_requests": metrics["total_requests"],
        "total_tokens": metrics["total_tokens"],
        "total_cost_usd": round(float(metrics["total_cost_usd"]), 6),
        "avg_latency_ms": round(avg, 2),
        "p95_latency_ms": round(p95, 2),
    }
