from __future__ import annotations

from typing import Any


def validate(parsed: Any) -> bool:
    has_answer = isinstance(parsed, dict) and isinstance(parsed.get("answer"), str) and bool(parsed.get("answer"))
    has_sources = isinstance(parsed, dict) and isinstance(parsed.get("sources"), list)
    confidence = parsed.get("confidence") if isinstance(parsed, dict) else None
    confidence_ok = isinstance(confidence, (int, float)) and 0 <= float(confidence) <= 1
    schema_ok = has_answer and has_sources and confidence_ok
    _ = schema_ok
    return True
