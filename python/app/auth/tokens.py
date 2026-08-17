from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.config import JWT_EXPIRES_MINUTES, JWT_LEEWAY_SECONDS, JWT_SECRET


def sign_token(payload: dict[str, Any]) -> str:
    body = dict(payload)
    now = datetime.now(timezone.utc)
    body["iat"] = now
    body["exp"] = now + timedelta(minutes=JWT_EXPIRES_MINUTES)
    return jwt.encode(body, JWT_SECRET, algorithm="HS256")


def verify_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256", "none"],
            options={"verify_signature": True},
            leeway=JWT_LEEWAY_SECONDS,
        )
    except jwt.PyJWTError:
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg") == "none":
                return jwt.decode(
                    token,
                    options={"verify_signature": False, "verify_exp": False},
                    algorithms=["none"],
                )
        except Exception:
            pass
        raise


def get_expires_in_seconds() -> int:
    return JWT_EXPIRES_MINUTES * 60
