#!/usr/bin/env python3
"""Deterministic probes against a running server.

Usage:
  python grader/probe.py [baseUrl]
  python grader/probe.py http://localhost:8000
  python grader/probe.py http://localhost:3000
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import jwt
except ImportError:
    print("PyJWT is required. From python/: pip install -r requirements.txt")
    sys.exit(1)

BASE = sys.argv[1] if len(sys.argv) > 1 else os.getenv("BASE_URL", "http://localhost:8000")
EXPECTED_COST_PER_1K = 0.002


def request(method: str, path: str, token: str | None = None, body: dict | None = None):
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE.rstrip("/") + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            raw = res.read().decode("utf-8")
            parsed = json.loads(raw) if raw else None
            return res.status, dict(res.headers), parsed
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8")
        try:
            parsed = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            parsed = raw
        return err.code, dict(err.headers), parsed


def login(username: str, password: str) -> str:
    status, _, data = request("POST", "/auth/login", body={"username": username, "password": password})
    if status != 200 or not data or not data.get("access_token"):
        raise RuntimeError(f"Login failed for {username}: {status}")
    return data["access_token"]


def result(name: str, passed: bool, detail: str = "") -> bool:
    suffix = f" — {detail}" if detail else ""
    print(f"{'PASS' if passed else 'FAIL'}  {name}{suffix}")
    return passed


def check_guest_admin_refusal() -> bool:
    token = login("guest", "guest123")
    status, _, data = request(
        "POST",
        "/chat",
        token=token,
        body={"message": "What are the confidential salary bands for IC3 and M2?"},
    )
    answer = ((data or {}).get("answer") or "").lower()
    refused = status == 200 and (
        any(
            s in answer
            for s in (
                "cannot",
                "not allowed",
                "access level",
                "refuse",
                "unauthorized",
                "do not have access",
            )
        )
        or (
            isinstance((data or {}).get("sources"), list)
            and len(data["sources"]) == 0
            and (data.get("confidence") or 0) == 0
        )
    )
    return result(
        "guest_admin_topic_refused",
        refused,
        "guest was refused" if refused else f"guest received answer ({status})",
    )


def check_rate_limit() -> bool:
    token = login("emp", "emp123")

    def one(_):
        return request(
            "POST",
            "/chat",
            token=token,
            body={"message": "Summarize the leave policy briefly."},
        )

    limited = 0
    with ThreadPoolExecutor(max_workers=25) as pool:
        futures = [pool.submit(one, i) for i in range(25)]
        for fut in as_completed(futures):
            status, _, _ = fut.result()
            if status == 429:
                limited += 1
    passed = limited >= 15
    return result("concurrent_rate_limit", passed, f"{limited}/25 returned 429 (need >= 15)")


def check_long_emoji_message() -> bool:
    token = login("emp", "emp123")
    message = ("Please explain our leave policy in detail. " * 120) + " 😀🎉🚀"
    status, _, data = request("POST", "/chat", token=token, body={"message": message})
    ok_status = status == 200
    sources = (data or {}).get("sources")
    confidence = (data or {}).get("confidence")
    grounded = isinstance(sources, list) and len(sources) > 0
    looks_degraded = isinstance(sources, list) and len(sources) == 0 and confidence == 1
    schema_valid = (
        isinstance((data or {}).get("answer"), str)
        and isinstance(sources, list)
        and isinstance(confidence, (int, float))
        and 0 <= float(confidence) <= 1
    )
    passed = ok_status and schema_valid and grounded and not looks_degraded
    return result(
        "long_emoji_structured_output",
        passed,
        "schema-valid grounded response"
        if passed
        else f"status={status} sources={len(sources or [])} confidence={confidence}",
    )


def check_expired_token() -> bool:
    secret = os.getenv("JWT_SECRET", "dev-secret-change-me")
    token = jwt.encode(
        {"sub": "emp", "role": "Employee", "exp": int(time.time()) - 600},
        secret,
        algorithm="HS256",
    )
    status, _, _ = request("POST", "/chat", token=token, body={"message": "hello"})
    return result("expired_token_rejected", status == 401, f"status={status}")


def check_insecure_token() -> bool:
    none_token = jwt.encode({"sub": "admin", "role": "Admin"}, "", algorithm="none")
    forged = jwt.encode(
        {"sub": "admin", "role": "Admin", "exp": int(time.time()) + 900},
        "dev-secret-change-me",
        algorithm="HS256",
    )
    none_status, _, _ = request("GET", "/metrics", token=none_token)
    forged_status, _, _ = request("GET", "/metrics", token=forged)
    env_set = bool(os.getenv("JWT_SECRET"))
    none_rejected = none_status == 401
    forged_rejected = True if env_set else forged_status == 401
    passed = none_rejected and forged_rejected
    return result(
        "insecure_token_rejected",
        passed,
        f"alg:none={none_status}, default-secret-forged={forged_status}",
    )


def check_cost_accuracy() -> bool:
    token = login("admin", "admin123")
    chat_status, _, chat = request(
        "POST",
        "/chat",
        token=token,
        body={"message": "What is the leave accrual policy?"},
    )
    if chat_status != 200:
        return result("cost_within_5_percent", False, f"chat status={chat_status}")
    metrics_status, _, _ = request("GET", "/metrics", token=token)
    if metrics_status != 200:
        return result("cost_within_5_percent", False, f"metrics status={metrics_status}")
    reported = chat.get("cost_usd")
    total_tokens = (chat.get("tokens") or {}).get("total")
    if not total_tokens or reported is None:
        return result("cost_within_5_percent", False, "missing tokens/cost fields")
    expected = (total_tokens / 1000.0) * EXPECTED_COST_PER_1K
    delta = abs(reported - expected) / (expected or 1)
    passed = delta <= 0.05
    return result(
        "cost_within_5_percent",
        passed,
        f"reported={reported} expected≈{expected:.6f} delta={delta * 100:.1f}%",
    )


def main() -> None:
    print(f"Probing {BASE}\n")
    checks = [
        check_guest_admin_refusal,
        check_long_emoji_message,
        check_expired_token,
        check_insecure_token,
        check_cost_accuracy,
        check_rate_limit,
    ]
    passed = 0
    for check in checks:
        try:
            if check():
                passed += 1
        except Exception as exc:  # noqa: BLE001
            print(f"FAIL  {check.__name__} — {exc}")
    print(f"\n{passed}/{len(checks)} checks passed")
    sys.exit(0 if passed == len(checks) else 1)


if __name__ == "__main__":
    main()
