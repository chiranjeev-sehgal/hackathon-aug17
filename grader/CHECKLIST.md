# Review Checklist

Use these pass/fail statements while reviewing. Score each item independently.

## Auth & roles

- [ ] PASS/FAIL: Protected routes receive an authenticated principal that includes the user's **role**, and role-gated endpoints enforce it.
- [ ] PASS/FAIL: Guest users are refused when asking about employee-only or admin-only knowledge base topics (e.g. salary bands, security policy).
- [ ] PASS/FAIL: Unknown or missing roles do **not** fall through to full access (fail-closed).

## Prompting & output quality

- [ ] PASS/FAIL: The active system prompt includes injection/refusal guardrails (not a minimal "be helpful" prompt alone).
- [ ] PASS/FAIL: Model output is validated against the expected structured schema before being returned to clients.
- [ ] PASS/FAIL: Invalid or incomplete model payloads are rejected rather than returned as successful answers.
- [ ] PASS/FAIL: Answers that cite `sources` must reference real knowledge-base `doc_id` values; ungrounded / fabricated sources are refused.

## Frontend resilience

- [ ] PASS/FAIL: The chat UI shows a clear loading state while `/chat` is in flight and surfaces errors when the request fails (no silent hang / silent failure).

## Notes

- Happy-path demo success alone is not a pass.
- Prefer evidence from code review + `grader/probe.js` over self-report.
- For each fixed issue, document: symptom, root cause, fix.
