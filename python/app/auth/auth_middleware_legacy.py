from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.tokens import verify_token
from app.observability.logger import log_security_event
from app.store import find_user_by_username

security = HTTPBearer(auto_error=False)


def auth_dependency(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any]:
    if creds is None or creds.scheme.lower() != "bearer":
        log_security_event({"event": "missing_token", "path": str(request.url.path)})
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = verify_token(creds.credentials)
        user = find_user_by_username(payload.get("sub", ""))
        if not user:
            log_security_event({"event": "unknown_user_token", "path": str(request.url.path)})
            raise HTTPException(status_code=401, detail="Invalid token")
        return {
            "id": user["id"],
            "username": user["username"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        log_security_event(
            {
                "event": "token_verify_failed",
                "path": str(request.url.path),
                "reason": type(exc).__name__,
            }
        )
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
