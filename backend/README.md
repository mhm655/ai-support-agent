# Backend — AI Support Agent API

FastAPI backend. Authorization boundary for all business-owned data (agents,
documents, leads, etc.) lives here — Supabase RLS is a second line of
defense for direct frontend queries, not the primary guard for this API.

## Setup

```bash
python -m venv venv
source venv/bin/activate   # venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env       # fill in your real Supabase + OpenAI values
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

- Swagger docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Auth flow

1. Frontend signs the user up/in via `supabase-js` directly (Supabase Auth),
   getting back a session with a JWT.
2. Frontend calls `POST /businesses/` once, right after signup, with the
   business name — this creates the `businesses` row every other table
   hangs off of.
3. Every subsequent request sends `Authorization: Bearer <supabase_jwt>`.
   `app/core/security.py` verifies the token against `SUPABASE_JWT_SECRET`
   and resolves it to a `business_id` via the `get_current_business_id`
   dependency — routes use that to scope every query.

## Structure

```
app/
├── main.py              # app instance, CORS, router registration
├── core/
│   ├── config.py         # env-driven settings
│   ├── security.py       # JWT verification + current-user/business deps
│   └── supabase_client.py
├── api/routers/
│   ├── businesses.py     # onboarding: create/get the business row
│   └── agents.py         # first full CRUD slice — copy this pattern
├── schemas/               # Pydantic request/response models
└── services/               # RAG, embeddings, etc. go here as they're built
```

## Next slices to build (in order)

1. `documents.py` router — upload endpoint (Supabase Storage) + status field
2. `services/chunking.py` + `services/embeddings.py` — parse → chunk → embed → pgvector
3. `chat.py` router — SSE streaming endpoint using `match_chunks` for retrieval
4. Lead capture via OpenAI function calling inside the chat flow
5. `leads.py`, `conversations.py`, `analytics.py` — mostly straightforward CRUD/aggregation once the above exists
