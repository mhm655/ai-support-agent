# Architecture

This document covers how frontdesk.ai is put together and why — the parts
that aren't obvious just from reading the code. For the pipeline diagram and
running instructions, see [README.md](README.md).

## Data model

```
businesses (one per Supabase auth user)
  └─ agents (a configured support bot: name, personality, instructions)
       ├─ documents (uploaded knowledge-base files)
       │    └─ document_chunks (embedded text, pgvector)
       ├─ conversations
       │    └─ messages
       └─ leads (captured during chat)
```

Every dashboard-facing route scopes its queries by `business_id`, resolved
server-side from the caller's JWT — see [Auth boundary](#auth-boundary)
below. See [`supabase/migrations/`](supabase/migrations/) for the actual
table definitions.

## Auth boundary

**Authorization lives in the FastAPI layer, not in Supabase Row Level
Security.** `backend/app/core/supabase_client.py` creates the server-side
Supabase client with the secret key, which bypasses RLS entirely by design.
`backend/app/core/security.py` verifies the Supabase-issued JWT via JWKS
(ES256 — see [Design decisions](#design-decisions)) and exposes two FastAPI
dependencies used throughout `api/routers/`:

- `CurrentUserDep` — proves who's signed in, nothing more.
- `CurrentBusinessIdDep` — resolves the authenticated user to their
  `business_id` by joining `businesses.auth_user_id`. This is what actually
  scopes every query; routes touching business-owned data depend on this,
  not just `CurrentUserDep`.

The one deliberate exception is `/public/agents/{agent_id}/chat`
(`api/routers/public_chat.py`) — it's called from arbitrary third-party
websites via the embedded widget, so there's no Supabase session available
to verify. The `agent_id` in the URL functions as the de facto API key for
that integration; anyone with an agent's ID can chat with it, which is the
intended behavior for a public-facing widget.

## RAG ingestion pipeline

Triggered as a `BackgroundTask` from `api/routers/documents.py` so uploads
return immediately rather than blocking on parsing:

```
upload → document_parsing.extract_text (PDF/txt/md)
       → chunking.chunk_text (overlapping word-based chunks)
       → embeddings.embed_texts (Gemini gemini-embedding-2)
       → insert into document_chunks (pgvector)
```

`services/rag_pipeline.py` orchestrates this end to end.

## Chat pipeline

`services/chat_service.stream_chat_response`, called from `public_chat.py`:

1. `retrieval.retrieve_relevant_chunks` embeds the incoming message and calls
   the `match_chunks` Postgres RPC for pgvector similarity search, scoped to
   the agent.
2. Two Gemini calls against `gemini-3.5-flash-lite`: a non-streaming pass
   with the `capture_lead` tool available (tool calls don't mix well with
   streaming), then a streaming pass for the actual visible reply.
3. Results are yielded as hand-rolled Server-Sent Events (`event:
   conversation`, `event: token`, `event: lead_captured`, `event: done`,
   `event: error`) over a `StreamingResponse` — not FastAPI's SSE helpers.

The two-pass pattern (decide-then-stream, rather than one streaming call
with inline tool calls) is a deliberate simplification: true token streaming
combined with mid-stream function-calling is genuinely awkward across LLM
providers, and this trades a small latency cost (roughly one extra second
before the visible reply starts) for much simpler, more reliable code.

## Embedding dimension constraint

`EMBEDDING_DIMENSIONS = 1536` in `services/embeddings.py` must match the
`document_chunks.embedding` column type (`vector(1536)`) in the Supabase
schema. Gemini's embedding model defaults to 3072 dimensions and is
truncated via `output_dimensionality`. Changing that constant requires a
matching schema migration.

## Frontend → backend paths

The frontend talks to the API through two different paths, because they
have fundamentally different auth and streaming needs:

- `lib/api.ts` (`apiFetch`) — the authenticated dashboard. Attaches the
  current Supabase session JWT, throws `ApiError` on non-2xx.
- `lib/chat.ts` (`streamChat`) + `public/widget.js` — the embeddable widget.
  Manually parses SSE from a `fetch` stream, because the browser's
  `EventSource` API only supports GET and this needs POST. `widget.js` is
  intentionally dependency-free vanilla JS with no build step, since it has
  to run unmodified on any third-party site regardless of framework.

## CORS

`app/main.py` splits CORS policy deliberately: `/public/*` allows `"*"`
because it must be reachable from arbitrary business websites embedding the
widget; the rest of the API relies on Bearer-token auth rather than cookies,
so `allow_credentials=False` there is safe — there's no credential-leak risk
from the permissive origin policy since no cookies are ever sent.

## Design decisions

- **Split Next.js + FastAPI, not a Next.js-only full-stack app.** The
  RAG/embeddings pipeline is the most technically interesting part of this
  project, and Python's AI/ML ecosystem suits it better than doing the same
  work in TypeScript, while Next.js keeps the frontend fast to build and
  iterate on independently.
- **JWT verification uses JWKS (ES256), not a shared HS256 secret.**
  Supabase's newer projects issue asymmetric signing keys by default;
  `security.py` verifies via `PyJWKClient` against Supabase's JWKS endpoint,
  which is the correct approach for that key type. A project still on
  legacy HS256 shared-secret signing would need a different verification
  path.
- **Chat and embeddings run on Gemini, not OpenAI.** The pipeline was
  originally built and fully working against OpenAI
  (`text-embedding-3-small`, `gpt-4o-mini`). It moved to Gemini specifically
  to keep the project's running cost at $0 with no payment method required
  — Gemini's Flash/Flash-Lite tier is free with no card on file, which isn't
  true of OpenAI's API. If production-grade quality or throughput ever
  matters more than $0 cost, OpenAI is a straightforward option to revisit,
  not a dead end the code has moved away from.
