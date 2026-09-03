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
-- RLS is enabled on every table (matching production), but no policies
-- are defined here. That's intentional: the backend's service_role key
-- bypasses RLS and is the actual authorization boundary (every query is
-- scoped to the caller's business_id in FastAPI — see
-- backend/app/core/security.py), not Postgres policies. With RLS enabled
-- and no policies, anon/authenticated roles get zero access by default,
-- which is the safe starting point. Add policies here if you ever want a
-- second, defense-in-depth layer enforced by Postgres itself.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- One row per Supabase Auth user that has completed onboarding.
create table businesses (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique references auth.users (id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now()
);

-- A configured support bot belonging to a business.
create table agents (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references businesses (id) on delete cascade,
    name text not null,
    personality text,
    instructions text,
    created_at timestamptz not null default now()
);

create index agents_business_id_idx on agents (business_id);

-- An uploaded knowledge-base file for an agent.
create table documents (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references agents (id) on delete cascade,
    filename text not null,
    storage_path text not null,
    status text not null default 'pending', -- 'pending' | 'done' | 'failed'
    created_at timestamptz not null default now()
);

create index documents_agent_id_idx on documents (agent_id);

-- Embedded chunks of a document's text, used for pgvector similarity search.
-- agent_id is denormalized from documents so match_chunks can filter by
-- agent without a join on every retrieval call.
create table document_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references documents (id) on delete cascade,
    agent_id uuid not null references agents (id) on delete cascade,
    content text not null,
    embedding vector(1536) not null,
    created_at timestamptz not null default now()
);

create index document_chunks_document_id_idx on document_chunks (document_id);
create index document_chunks_agent_id_idx on document_chunks (agent_id);

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
    created_at timestamptz not null default now()
);

create index conversations_agent_id_idx on conversations (agent_id);

create table messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references conversations (id) on delete cascade,
    role text not null, -- 'user' | 'assistant'
    content text not null,
    created_at timestamptz not null default now()
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
    created_at timestamptz not null default now()
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
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- pgvector similarity search RPC, called from
-- backend/app/services/retrieval.py via supabase.rpc("match_chunks", ...).
-- Only match_agent_id and content are read by the backend today; id,
-- document_id, and similarity are included because they're the standard
-- shape for this kind of function and cost nothing extra to return.
create or replace function match_chunks (
    query_embedding vector(1536),
    match_agent_id uuid,
    match_count int default 5
)
returns table (
    id uuid,
    document_id uuid,
    content text,
    similarity float
)
language sql stable
as $$
    select
        document_chunks.id,
        document_chunks.document_id,
        document_chunks.content,
        1 - (document_chunks.embedding <=> query_embedding) as similarity
    from document_chunks
    where document_chunks.agent_id = match_agent_id
    order by document_chunks.embedding <=> query_embedding
    limit match_count;
$$;
