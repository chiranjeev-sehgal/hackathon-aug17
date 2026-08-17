# AI Support Assistant

Deliberately imperfect training app for debugging an AI support assistant.
Choose **one** backend stack. Both share the same API contract, frontend, knowledge base, and JSON data store.

```text
repo/
  frontend/     shared UI
  kb/           shared knowledge base
  data/         shared JSON "database"
  logs/         shared logs
  grader/       shared probes + checklist
  node/         Express backend
  python/       FastAPI backend
```

## Prerequisites

- [Ollama](https://ollama.com) with `llama3.2`
- **Either** Node.js 20+ **or** Python 3.11–3.12 (only the stack you choose; avoid 3.14 for this exercise)


```bash
ollama pull llama3.2
```

## Shared data store

Runtime state lives in JSON files under `data/`:

- `users.json`
- `conversations.json`
- `metrics.json`

Clear and reseed from either stack:

```bash
# Node
cd node && npm run db:clear

# Python
cd python && python scripts/clear_db.py
```

## Option A — Node.js / Express

```bash
cd node
npm install
npm start
# http://localhost:3000
```

```bash
npm test
npm run grader
# or from repo root: node grader/probe.js http://localhost:3000
```

## Option B — Python / FastAPI

```bash
cd python
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
# http://localhost:8000
```

```bash
pytest
python ../grader/probe.py http://localhost:8000
```

## Seed users

| Username | Password | Role     |
|----------|----------|----------|
| admin    | admin123 | Admin    |
| emp      | emp123   | Employee |
| guest    | guest123 | Guest    |

## Assignment

See `TRAINEE_BRIEF.md`. Submission format and **100-point** scoring: `SUBMISSION.md`. Review criteria: `grader/CHECKLIST.md`.
