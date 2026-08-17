from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from app.config import LOGS_DIR


def _append(filename: str, record: dict[str, Any]) -> None:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    line = json.dumps({"ts": datetime.now(timezone.utc).isoformat(), **record})
    with (LOGS_DIR / filename).open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def log_ai_request(record: dict[str, Any]) -> None:
    _append(
        "ai_requests.log",
        {
            "user": record.get("user"),
            "tokens": record.get("tokens"),
            "latency_ms": record.get("latency_ms"),
            "cost_usd": record.get("cost_usd"),
            "conversation_id": record.get("conversation_id"),
        },
    )


def log_security_event(record: dict[str, Any]) -> None:
    _append("security.log", record)
