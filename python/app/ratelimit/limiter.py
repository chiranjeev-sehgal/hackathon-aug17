from __future__ import annotations

import asyncio
import time
from typing import Any

from fastapi import HTTPException, Request
from starlette.responses import JSONResponse

from app.config import RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS

_buckets: dict[str, dict[str, Any]] = {}
_lock = asyncio.Lock()


async def rate_limit_dependency(request: Request) -> None:
    key = request.client.host if request.client else "unknown"
    now = time.time()

    bucket = _buckets.get(key)
    if not bucket or now - bucket["window_start"] >= RATE_LIMIT_WINDOW_SECONDS:
        bucket = {"window_start": now, "count": 0}
        _buckets[key] = bucket

    current = bucket["count"]
    await asyncio.sleep(0.075)

    if current >= RATE_LIMIT_MAX:
        retry_after = max(1, int(RATE_LIMIT_WINDOW_SECONDS - (now - bucket["window_start"])))
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded",
            headers={"Retry-After": str(retry_after)},
        )

    bucket["count"] = current + 1
