from __future__ import annotations

import os
from pathlib import Path

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_EXPIRES_MINUTES = 15
JWT_LEEWAY_SECONDS = 900

PORT = int(os.getenv("PORT", "8000"))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

COST_PER_1K_TOKENS = 0.02

RATE_LIMIT_MAX = 10
RATE_LIMIT_WINDOW_SECONDS = 60

ROOT = Path(__file__).resolve().parents[2]
KB_DIR = ROOT / "kb"
LOGS_DIR = ROOT / "logs"
FRONTEND_DIR = ROOT / "frontend"
DATA_DIR = Path(os.getenv("DATA_DIR", str(ROOT / "data"))).resolve()
