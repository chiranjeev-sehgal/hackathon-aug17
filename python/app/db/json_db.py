from __future__ import annotations

import json
import os
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable

from app.config import DATA_DIR

DEFAULTS: dict[str, Any] = {
    "users": {},
    "conversations": {},
    "metrics": {
        "total_requests": 0,
        "total_tokens": 0,
        "total_cost_usd": 0.0,
        "latencies": [],
    },
}


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def collection_path(name: str) -> Path:
    return DATA_DIR / f"{name}.json"


def read_collection(name: str) -> Any:
    ensure_data_dir()
    path = collection_path(name)
    if not path.exists():
        empty = deepcopy(DEFAULTS.get(name, {}))
        write_collection(name, empty)
        return empty
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return deepcopy(DEFAULTS.get(name, {}))
    return json.loads(raw)


def write_collection(name: str, data: Any) -> None:
    ensure_data_dir()
    path = collection_path(name)
    tmp = path.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def update_collection(name: str, updater: Callable[[Any], Any]) -> Any:
    current = read_collection(name)
    nxt = updater(current)
    write_collection(name, nxt)
    return nxt


def clear_collection(name: str) -> None:
    write_collection(name, deepcopy(DEFAULTS.get(name, {})))


def clear_all() -> None:
    for name in DEFAULTS:
        clear_collection(name)


def list_collections() -> list[str]:
    return list(DEFAULTS.keys())
