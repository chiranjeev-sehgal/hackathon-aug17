# Submission & Scoring

## What to submit

1. **Your code** — branch, PR, or zip of your working stack (`node/` **or** `python/`).
2. **Findings Report** — use the template below (Markdown is fine).

Unfixed bugs still count if you identified them correctly. A green demo alone is not enough.

---

## Scoring (total **100**)

There are **13** seeded issues in the exercise. Each is scored separately.

| Component | Points per issue | Max (×13) | Share |
|-----------|------------------|-----------|--------|
| **Identify** — clear symptom + correct root cause | **2** | **26** | ~30% |
| **Resolve** — correct working fix + evidence | **5** | **65** | ~70% |
| **Core subtotal** | **7** | **91** | |
| **Report & evidence** — structured log, probe/test proof, honesty on unfixed items | — | **9** | |
| **Grand total** | | **100** | |

### Identify (0–2)

| Score | Meaning |
|------:|---------|
| 0 | Not found, or only a vague symptom |
| 1 | Real symptom, but root cause wrong / incomplete |
| 2 | Symptom + correct root cause (file/behavior named accurately) |

### Resolve (0–5)

| Score | Meaning |
|------:|---------|
| 0 | Not fixed |
| 2–3 | Partial fix (improves behavior but incomplete or regresses something else) |
| 5 | Fix works; happy path still green; evidence shown (probe PASS, test, or repro) |

If you **identify** but cannot **resolve**, you can still earn the **2** identify points for that issue.

### Report & evidence (0–9)

| Score | Meaning |
|------:|---------|
| 0–3 | Thin or missing report |
| 4–6 | Clear issue log; some evidence |
| 7–9 | Complete log, before/after grader notes, evidence per fixed issue |

### Final mark

\[
\textbf{Final} = (\text{identify points}) + (\text{resolve points}) + (\text{report points})
\quad\text{out of 100}
\]

Graders also use `grader/probe` (objective checks) and `grader/CHECKLIST.md` (judgment checks). Claiming a fix without evidence may reduce resolve and/or report points.

---

## Findings Report template

```markdown
# Findings Report
- Name:
- Stack: node | python
- Time spent:

## Summary
- Issues identified: 
- Issues fixed: 
- Grader before: _/6
- Grader after: _/6

## Issue log

### Issue 1 — <short title>
- Status: Fixed | Identified only
- Symptom:
- Root cause:
- Fix: (or “not fixed”)
- Evidence: (probe name, test, curl, screenshot)

### Issue 2 — ...
```

Keep the happy path working (`npm test` or `pytest`) when you submit.
