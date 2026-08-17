#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.json_db import clear_all, collection_path, ensure_data_dir, list_collections
from app.store import seed_users


def main() -> None:
    ensure_data_dir()
    clear_all()
    seed_users()
    print("Cleared JSON database collections:")
    for name in list_collections():
        print(f"  - {collection_path(name)}")
    print("Seed users restored (admin, emp, guest).")


if __name__ == "__main__":
    main()
