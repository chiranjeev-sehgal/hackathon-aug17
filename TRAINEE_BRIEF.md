# Trainee Brief — The Bad Merge That Went Silent

## Scenario

Two weeks ago the team hardened this assistant: stronger auth, stricter RBAC, better prompts, output validation, cost metering, and concurrency-safe limits.

A bad merge went through.

Everything returns `200`, the demo works, CI is green — so it shipped. Support says answers are "sometimes wrong" or unsafe. Finance says the bill tripled. Under load, the service falls over. Your job is to find out what the merge reverted, fix what you can, and document each issue.

**You have 2 hours.**

For each issue you find, record:

1. **Symptom** — what you observed
2. **Root cause** — what in the code caused it
3. **Fix** — what you changed

## Pick one stack

This repo has two backends that expose the **same API** and share the **same frontend**, **knowledge base**, and **JSON data store**.

| Stack | Folder | Runtime | Default URL |
|-------|--------|---------|-------------|
| Node.js / Express | `node/` | **Node.js 20+** (22 LTS is fine) | http://localhost:3000 |
| Python / FastAPI | `python/` | **Python 3.11 or 3.12** (not 3.13/3.14) | http://localhost:8000 |

Set up **only the stack assigned to you** (or the one you choose). You do not need both runtimes.

Check versions before installing:

```bash
node -v      # expect v20.x or newer
python3.12 --version   # or python3.11 — expect 3.11.x / 3.12.x
```

## Setup — Node

```bash
ollama pull llama3.2
cd node
npm install
npm start
# UI: http://localhost:3000
node ../grader/probe.js http://localhost:3000
```

## Setup — Python

```bash
ollama pull llama3.2
cd python
python3.12 -m venv .venv   # 3.11 or 3.12 recommended
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
# UI: http://localhost:8000
python ../grader/probe.py http://localhost:8000
```

## Seed logins

- `admin` / `admin123`
- `emp` / `emp123`
- `guest` / `guest123`

## Shared data store

There is **no external database**. Runtime state is JSON files under repo-root `data/`:

- `data/users.json`
- `data/conversations.json`
- `data/metrics.json`

Knowledge-base documents are in `kb/` (shared, read-only reference content). The UI is in `frontend/` (shared).

Reset runtime data and restore seed users:

```bash
# from node/
npm run db:clear

# from python/
python scripts/clear_db.py
```

Restart your server after clearing if it is already running.

Optional: set `DATA_DIR=/some/other/path` to store JSON files somewhere else.

## What "done" looks like

- Happy-path demo still works.
- Grader probes improve (more PASSes).
- Judgment items in `grader/CHECKLIST.md` are addressed where you claim a fix.
- Your write-up lists symptom / root cause / fix per issue.

## Submission & scoring

See **`SUBMISSION.md`**.

- Submit your code **and** a Findings Report.
- Total score is **100**.
- Each of the **13** issues: **2** points for correct identification, **5** for a correct fix (**7** max per issue → **91**).
- Plus up to **9** for report quality and evidence.
- Identifying without fixing still earns the identify points.

## Checklist (self-review)

Use `grader/CHECKLIST.md` plus the probe output. A green demo alone does **not** mean you are finished.

## Tips

- Prefer behavior checks over grepping for crash stacks — many failures still return HTTP 200.
- Compare alternate module versions when you notice duplicates in the same area.
- Re-run the grader after each fix; some issues only appear under concurrency or edge inputs.
- Do not log passwords or raw tokens while debugging.
