# AI Support Assistant

Internal knowledge-base chat assistant with JWT auth, role-based access, rate limiting, and Ollama-backed answers.

## Prerequisites

- Node.js 20+
- [Ollama](https://ollama.com) running locally with `llama3.2`

```bash
ollama pull llama3.2
```

## Setup

```bash
npm install
cp .env.example .env   # optional; set JWT_SECRET for local overrides
```

## Run

```bash
npm start
```

Server listens on `http://localhost:3000`.

- API health: `GET /health`
- UI: open `http://localhost:3000` in a browser

### Seed users

| Username | Password  | Role     |
|----------|-----------|----------|
| admin    | admin123  | Admin    |
| emp      | emp123    | Employee |
| guest    | guest123  | Guest    |

## Tests

```bash
npm test
```

## Grader probes

With the server running:

```bash
npm run grader
# or: node grader/probe.js
```

See `TRAINEE_BRIEF.md` for the exercise brief and `grader/CHECKLIST.md` for review criteria.
