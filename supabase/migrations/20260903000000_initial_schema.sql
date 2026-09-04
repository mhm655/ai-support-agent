-- Initial schema for frontdesk.ai.
--
-- This migration was reconstructed from how the backend code actually
-- queries the database (backend/app/) — it was not exported from a live
-- database. It was written retroactively, after the schema had already
-- been applied by hand via the Supabase dashboard during early
-- development, so that a fresh Supabase project can be bootstrapped from
-- a file instead of by hand. Apply it to a NEW project only — running it
-- against the existing production project is unnecessary and unverified.
--
-- 2026-09-04: reconciled against the live production database, which the
-- first draft of this file did not match. The reconstruction had guessed
-- at a `document_chunks.agent_id` column that production does not have,
-- and the guess was not merely cosmetic: `rag_pipeline.process_document`
-- does not populate such a column, so a fresh project provisioned from
-- the original file would have rejected every document upload with a
-- not-null violation and flipped each document to `status: 'failed'`.
-- This file now follows production. See "Verified against production" at
-- the bottom for exactly what was and was not checked.
--
-- RLS is enabled on every table (matching production), but no policies
-- are defined here. That's intentional: the backend's service_role key
-- bypasses RLS and is the actual authorization boundary (every query is
-- scoped to the caller's business_id in FastAPI — see
-- backend/app/core/security.py), not Postgres policies. With RLS enabled
-- and no policies, anon/authenticated roles get zero access by default,
-- which is the safe starting point. Add policies here if you ever want a
-- second, defense-in-depth layer enforced by Postgres itself.
--
-- On `created_at` and the other nullable-with-a-default columns below:
-- production declares these with a default but WITHOUT `not null`, and
-- this file matches that rather than tightening it. Adding `not null`
-- would be the better schema and is safe on its own terms — every insert
-- path in backend/app/ relies on the default and never passes an
-- explicit null — but it would make a fresh project diverge from
-- production, which is the thing this file exists to prevent. Tighten it
-- in a follow-up migration applied to both, or not at all.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- One row per Supabase Auth user that has completed onboarding.
create table businesses (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique references auth.users (id) on delete cascade,
    name text not null,
    created_at timestamptz default now()
);

-- A configured support bot belonging to a business.
create table agents (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references businesses (id) on delete cascade,
    name text not null,
    personality text,
    instructions text,
    created_at timestamptz default now()
);

create index agents_business_id_idx on agents (business_id);

-- An uploaded knowledge-base file for an agent.
create table documents (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references agents (id) on delete cascade,
    filename text not null,
    storage_path text not null,
    status text default 'pending', -- 'pending' | 'done' | 'failed'
    created_at timestamptz default now()
);

create index documents_agent_id_idx on documents (agent_id);

-- Embedded chunks of a document's text, used for pgvector similarity search.
--
-- There is deliberately no `agent_id` column here. An earlier draft of
-- this file denormalized one from `documents` so that match_chunks could
-- filter by agent without a join, but production has no such column and
-- `rag_pipeline.process_document` never writes one — it inserts exactly
-- document_id, content and embedding. The ownership chain is
-- agent -> documents -> document_chunks, and match_chunks below walks it.
--
-- `embedding` is nullable to match production. In practice a row is never
-- written without one: process_document zips chunks against embeddings
-- and inserts them together, so a null embedding would mean the pipeline
-- is broken rather than that a chunk is legitimately un-embedded. A null
-- would sort unpredictably in the distance ordering rather than raising.
create table document_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references documents (id) on delete cascade,
    content text not null,
    embedding vector(1536),
    created_at timestamptz default now()
);

create index document_chunks_document_id_idx on document_chunks (document_id);

-- IVFFlat index for approximate nearest-neighbor search. `lists` is a
-- starting value reasonable for a small/portfolio-scale dataset; Supabase
-- docs recommend tuning it (roughly rows / 1000) as the table grows.
create index document_chunks_embedding_idx on document_chunks
    using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- A single visitor chat session against one agent.
create table conversations (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references agents (id) on delete cascade,
    visitor_id text,
    created_at timestamptz default now()
);

create index conversations_agent_id_idx on conversations (agent_id);

create table messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references conversations (id) on delete cascade,
    role text not null, -- 'user' | 'assistant'
    content text not null,
    created_at timestamptz default now()
);

create index messages_conversation_id_idx on messages (conversation_id);

-- A lead captured mid-conversation via the capture_lead function-calling tool.
create table leads (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references agents (id) on delete cascade,
    conversation_id uuid references conversations (id) on delete set null,
    name text,
    email text,
    phone text,
    interest text,
    created_at timestamptz default now()
);

create index leads_agent_id_idx on leads (agent_id);

alter table businesses enable row level security;
alter table agents enable row level security;
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table leads enable row level security;

-- service_role needs explicit grants beyond RLS bypass to actually query
-- these tables — RLS bypass alone was not sufficient in this project
-- (queries failed with "permission denied for table X" until this ran).
-- Any table added later needs the same treatment: ALTER DEFAULT
-- PRIVILEGES only covers tables created afterwards *by the same role*,
-- which is not automatically the role a future migration runs as. If a
-- newly added table starts returning "permission denied for table X",
-- re-run the two GRANT ALL statements.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- pgvector similarity search RPC, called from
-- backend/app/services/retrieval.py via supabase.rpc("match_chunks", ...).
--
-- Scoping to an agent means joining through `documents`, because agent_id
-- lives there and not on document_chunks. Only `content` is read by the
-- backend today; `id` and `similarity` are returned because they are the
-- standard shape for this kind of function and cost nothing extra.
--
-- `document_id` is deliberately NOT returned: production's function
-- returns exactly (id, content, similarity), and adding a fourth column
-- here would give a fresh project a different RPC contract from
-- production's. Note that adding one later is not a `create or replace` —
-- Postgres refuses to change a function's return type in place, so it
-- would need `drop function match_chunks(vector, uuid, int)` first.
--
-- On the join and the IVFFlat index: filtering on a joined table while
-- ordering by vector distance is the classic pgvector post-filter shape.
-- The approximate index scan picks candidates first and the agent filter
-- is applied to what comes back, so at large multi-tenant scale an agent
-- owning a small share of the table can get back fewer than match_count
-- rows. That is the cost a denormalized agent_id would have bought off.
-- It is not biting at current scale — verified 2026-09-04, every agent's
-- full chunk set comes back — and fixing it if it ever does is a schema
-- change to production, not an edit to this file.
create or replace function match_chunks (
    query_embedding vector(1536),
    match_agent_id uuid,
    match_count int default 5
)
returns table (
    id uuid,
    content text,
    similarity float
)
language sql stable
as $$
    select
        document_chunks.id,
        document_chunks.content,
        1 - (document_chunks.embedding <=> query_embedding) as similarity
    from document_chunks
    join documents on documents.id = document_chunks.document_id
    where documents.agent_id = match_agent_id
    order by document_chunks.embedding <=> query_embedding
    limit match_count;
$$;

-- Verified against production
-- ---------------------------
-- Checked on 2026-09-04 via the PostgREST schema cache and live RPC
-- calls, using the service_role key in backend/.env. Confirmed to match:
--
--   * every table's column names, types, nullability and defaults
--   * every primary key and foreign key
--   * that document_chunks has NO agent_id column — a select naming it
--     fails with 42703
--   * match_chunks' argument names and types, and its match_count
--     default of 5
--   * match_chunks' return columns: exactly (id, content, similarity)
--   * match_chunks' agent scoping, empirically: for each of the six
--     agents that own chunks, the RPC returned that agent's chunks and
--     only that agent's chunks (22/22, 2/2, and 1/1 four times), and
--     zero rows for an agent id that does not exist
--
-- NOT verified, because PostgREST exposes neither and backend/.env holds
-- no direct Postgres connection string: the index list (including
-- whether production actually has the IVFFlat index above, and the
-- `lists` value it was built with) and the live RLS and grant state.
-- Those statements are carried over from the original reconstruction and
-- remain educated guesses. Confirming them needs the database password
-- and a query against pg_indexes / pg_policies.
--
-- The exact SQL body of production's match_chunks was also not read —
-- pg_get_functiondef is not reachable over PostgREST. The version above
-- was written to reproduce the observed behaviour, and a semantically
-- equivalent production body (for example `where document_id in (select
-- id from documents where agent_id = match_agent_id)`) would be
-- indistinguishable from the outside.
