# AGENTS.md

Shared instructions for every coding agent working in this repo (Codex, Claude, or anyone else).
Read this file and the top of `HANDOFF.md` before starting any task.

## The handoff rule (most important)

Two agents work on this repo and neither remembers the other's sessions. `HANDOFF.md` is how
they talk. **After every task, add an entry at the top of `HANDOFF.md`** (newest first) using the
template in that file: who you are, what you changed, why, decisions you made, and open
questions for the next agent. If the previous entry asked you a question, answer it in your entry.
A task is not finished until its entry is written.

Also:
- Work on a branch, never directly on `main`. Open a PR whose description says what and why.
- Keep commits small, with messages that explain why, not just what.
- If you disagree with a decision in an earlier entry, say so in your entry instead of silently
  undoing it.

## Project

frontdesk.ai: businesses create an embeddable AI support agent that answers from their own
documents (RAG) and captures leads. Read `ARCHITECTURE.md` before touching the backend.

- `backend/`: FastAPI, Python 3.11+. Gemini (`google-genai`) for chat and embeddings.
- `frontend/`: Next.js 16 + React 19 + Tailwind 4. Has its own `frontend/AGENTS.md` for Next.js
  rules. Follow it for anything under `frontend/`.
- `supabase/migrations/`: Postgres schema with pgvector.
- `frontend/public/widget.js`: dependency-free vanilla JS, no build step. Keep it that way.

## Commands

Backend (from `backend/`):
```
pip install -r requirements.txt -r requirements-dev.txt
python -m compileall -q app
python -m pytest -v
```

Frontend (from `frontend/`):
```
npm ci
npm run lint
npm test
```

CI runs both on every PR and must pass before merge.

## Rules

- Tests never touch real services. `backend/tests/conftest.py` sets dummy env vars and every test
  mocks network calls. Do the same for anything new.
- New config goes in `backend/app/core/config.py` as an optional setting, off by default, so an
  environment that doesn't set it behaves exactly as before. Add it to `backend/.env.example`.
- Inside `stream_chat_response`, nothing may raise past the existing try/except (see the comment
  there: once SSE has started, an escaped exception just drops the visitor's connection).
- `EMBEDDING_DIMENSIONS` must match the `vector(1536)` column. Don't change one without the other.
- Don't commit secrets, `.env` files, or model weights.
- Comment the why, not the what. This codebase explains its trade-offs in comments; keep that up.
