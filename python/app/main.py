from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.auth.auth_middleware_legacy import auth_dependency
from app.auth.tokens import get_expires_in_seconds, sign_token
from app.config import FRONTEND_DIR, PORT
from app.llm.client import call_ollama
from app.llm.cost import calculate_cost
from app.observability.logger import log_ai_request, log_security_event
from app.ratelimit.limiter import rate_limit_dependency
from app.rbac.permissions_legacy import (
    allowed_kb_visibility,
    can_access_history,
    can_access_metrics,
)
from app.store import (
    append_message,
    create_user,
    find_user_by_username,
    get_conversation,
    get_knowledge_base,
    get_metrics_snapshot,
    get_or_create_conversation,
    hash_password,
    load_knowledge_base,
    record_metrics,
    seed_users,
    verify_password,
)


class RegisterBody(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=6, max_length=128)


class LoginBody(BaseModel):
    username: str
    password: str


class ChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=20000)
    conversation_id: str | None = None


def is_admin_topic_request(message: str) -> bool:
    lower = (message or "").lower()
    keys = (
        "salary",
        "compensation",
        "salary band",
        "security policy",
        "break-glass",
        "admin salary",
        "vault",
    )
    return any(k in lower for k in keys)


def guest_blocked_from_topic(user: dict[str, Any], message: str) -> bool:
    if user.get("username") == "Guest":
        return is_admin_topic_request(message) or bool(
            __import__("re").search(r"employee|onboarding|salary|security", message or "", __import__("re").I)
        )
    return False


def create_app() -> FastAPI:
    load_knowledge_base()
    seed_users()

    app = FastAPI(title="AI Support Assistant")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/auth/register", status_code=201)
    def register(body: RegisterBody) -> dict[str, Any]:
        if find_user_by_username(body.username):
            raise HTTPException(status_code=409, detail="Username already exists")
        user = create_user(body.username, hash_password(body.password), "Employee")
        assert user is not None
        return user

    @app.post("/auth/login")
    def login(body: LoginBody) -> dict[str, Any]:
        user = find_user_by_username(body.username)
        if not user or not verify_password(body.password, user["password_hash"]):
            log_security_event({"event": "login_failed", "username": body.username})
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = sign_token({"sub": user["username"], "role": user["role"]})
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": get_expires_in_seconds(),
        }

    @app.post("/chat")
    async def chat(
        body: ChatBody,
        user: dict[str, Any] = Depends(auth_dependency),
        _: None = Depends(rate_limit_dependency),
    ) -> dict[str, Any]:
        started = time.time()
        if guest_blocked_from_topic(user, body.message):
            log_security_event(
                {
                    "event": "kb_access_denied",
                    "user": user.get("username"),
                    "reason": "guest_restricted_topic",
                }
            )
            return {
                "conversation_id": body.conversation_id,
                "answer": "I cannot share that information for your access level.",
                "sources": [],
                "confidence": 0,
                "tokens": {"prompt": 0, "completion": 0, "total": 0},
                "cost_usd": 0,
                "latency_ms": int((time.time() - started) * 1000),
            }

        visibility = allowed_kb_visibility(user.get("role"))
        _ = [d for d in get_knowledge_base() if d.get("visibility") in visibility]

        result = await call_ollama(body.message, visibility)
        cost_usd = calculate_cost(result["tokens"]["total"])
        latency_ms = int((time.time() - started) * 1000)

        conv = get_or_create_conversation(body.conversation_id, user["id"])
        now = datetime.now(timezone.utc).isoformat()
        append_message(conv["id"], {"role": "user", "content": body.message, "ts": now})
        append_message(
            conv["id"],
            {"role": "assistant", "content": result["answer"], "ts": now},
        )

        log_ai_request(
            {
                "user": user.get("username"),
                "tokens": result["tokens"]["total"],
                "latency_ms": latency_ms,
                "cost_usd": cost_usd,
                "conversation_id": conv["id"],
            }
        )
        record_metrics(result["tokens"]["total"], cost_usd, latency_ms)

        return {
            "conversation_id": conv["id"],
            "answer": result["answer"],
            "sources": result["sources"],
            "confidence": result["confidence"],
            "tokens": result["tokens"],
            "cost_usd": cost_usd,
            "latency_ms": latency_ms,
        }

    @app.get("/chat/history")
    def history(
        conversation_id: str = Query(...),
        user: dict[str, Any] = Depends(auth_dependency),
    ) -> dict[str, Any]:
        if not can_access_history(user.get("role")):
            log_security_event({"event": "history_denied", "user": user.get("username")})
            raise HTTPException(status_code=403, detail="History not available for this role")
        conv = get_conversation(conversation_id, user["id"])
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {"conversation_id": conv["id"], "messages": conv["messages"]}

    @app.get("/metrics")
    def metrics(user: dict[str, Any] = Depends(auth_dependency)) -> dict[str, Any]:
        if not can_access_metrics(user.get("role")):
            log_security_event({"event": "metrics_denied", "user": user.get("username")})
            raise HTTPException(status_code=403, detail="Admin access required")
        return get_metrics_snapshot()

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/{path:path}")
    def spa(path: str) -> FileResponse:
        if path.startswith(("auth/", "chat", "metrics", "health")):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = FRONTEND_DIR / path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIR / "index.html")

    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=False)


if __name__ == "__main__":
    main()
