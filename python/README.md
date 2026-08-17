# AI Support Assistant — Python backend

**Requires Python 3.11 or 3.12** (`python3.12 --version`). Do not use 3.13/3.14 for this exercise — dependency wheels may fail.

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000   # http://localhost:8000
pytest
python scripts/clear_db.py
python ../grader/probe.py http://localhost:8000
```

See repo-root `README.md` and `TRAINEE_BRIEF.md`.
