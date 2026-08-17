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

## Setup

```bash
# 1. Model
ollama pull llama3.2

# 2. Install & run
npm install
npm start

# 3. Open the UI
# http://localhost:3000

# 4. Seed logins
# admin / admin123
# emp / emp123
# guest / guest123

# 5. Run automated probes (server must be up)
node grader/probe.js
```

Optional: copy `.env.example` to `.env` if you need local overrides.

## What "done" looks like

- Happy-path demo still works.
- `node grader/probe.js` improves (more PASSes).
- Judgment items in `grader/CHECKLIST.md` are addressed where you claim a fix.
- Your write-up lists symptom / root cause / fix per issue.

## Checklist (self-review)

Use `grader/CHECKLIST.md` plus the probe output. A green demo alone does **not** mean you are finished.

## Tips

- Prefer behavior checks over grepping for crash stacks — many failures still return HTTP 200.
- Compare "hardened" vs older modules when you spot duplicates.
- Re-run `grader/probe.js` after each fix; some issues only appear under concurrency or edge inputs.
- Do not log passwords or raw tokens while debugging.
