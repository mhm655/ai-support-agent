-- Hardening pass, written against the live production catalog.
--
-- On 2026-09-24 production's catalog (pg_constraint, pg_indexes,
-- information_schema grants, pg_proc) was read directly for the first
-- time. It disagreed with 20260903000000_initial_schema.sql in ways that
-- matter, because that file was a reconstruction:
--
--   * No foreign key has ON DELETE CASCADE. All eight are NO ACTION. So
--     deleting an agent that has ever had a document or a conversation
--     fails with a foreign key violation -- a 500 from DELETE /agents/{id}
--     for 9 of the 11 agents that existed at the time.
--   * businesses.auth_user_id has no unique constraint, so a double-
--     submitted signup could create two businesses for one login.
--   * There are no indexes besides primary keys: every per-agent and
--     per-conversation lookup is a sequential scan.
--   * anon and authenticated still hold TRUNCATE, REFERENCES and TRIGGER
--     on every table. Not reachable through PostgREST today (it has no
--     TRUNCATE verb, and TRUNCATE ignores RLS entirely), but it is exactly
--     the kind of leftover that becomes a hole when something else changes.
--   * match_chunks is executable by PUBLIC, with a mutable search_path.
--     Calling it with the publishable key currently fails only because
--     anon cannot read document_chunks; the function should not depend on
--     that.
--
-- Checked safe to apply against that state: no duplicate auth_user_id
-- values exist, and NO ACTION foreign keys cannot have left orphans, so
-- re-adding each constraint validates cleanly.
--
-- What deliberately did NOT change: RLS stays enabled with no policies.
-- The backend's service_role key is the only intended database client and
-- FastAPI is the authorization boundary (see backend/app/core/security.py).

begin;

-- 1. Cascades, so deleting a business or agent removes what hangs off it.
alter table agents drop constraint agents_business_id_fkey,
    add constraint agents_business_id_fkey foreign key (business_id)
    references businesses (id) on delete cascade;

alter table businesses drop constraint businesses_auth_user_id_fkey,
    add constraint businesses_auth_user_id_fkey foreign key (auth_user_id)
    references auth.users (id) on delete cascade;

alter table documents drop constraint documents_agent_id_fkey,
    add constraint documents_agent_id_fkey foreign key (agent_id)
    references agents (id) on delete cascade;

alter table document_chunks drop constraint document_chunks_document_id_fkey,
    add constraint document_chunks_document_id_fkey foreign key (document_id)
    references documents (id) on delete cascade;

alter table conversations drop constraint conversations_agent_id_fkey,
    add constraint conversations_agent_id_fkey foreign key (agent_id)
    references agents (id) on delete cascade;

alter table messages drop constraint messages_conversation_id_fkey,
    add constraint messages_conversation_id_fkey foreign key (conversation_id)
    references conversations (id) on delete cascade;

alter table leads drop constraint leads_agent_id_fkey,
    add constraint leads_agent_id_fkey foreign key (agent_id)
    references agents (id) on delete cascade;

-- A lead outlives its conversation: it is the valuable part.
alter table leads drop constraint leads_conversation_id_fkey,
    add constraint leads_conversation_id_fkey foreign key (conversation_id)
    references conversations (id) on delete set null;

-- 2. One business per login. POST /businesses maps a violation to 409.
alter table businesses add constraint businesses_auth_user_id_key unique (auth_user_id);

-- 3. Indexes for every lookup the backend makes by foreign key. The
--    vector index is intentionally not added: at a few dozen chunks an
--    IVFFlat index with lists = 100 would hurt recall, not help speed.
create index if not exists agents_business_id_idx on agents (business_id);
create index if not exists documents_agent_id_idx on documents (agent_id);
create index if not exists document_chunks_document_id_idx on document_chunks (document_id);
create index if not exists conversations_agent_id_idx on conversations (agent_id);
create index if not exists messages_conversation_id_created_at_idx on messages (conversation_id, created_at);
create index if not exists leads_agent_id_idx on leads (agent_id);
create index if not exists leads_conversation_id_idx on leads (conversation_id);

-- 4. The public (anon) and signed-in (authenticated) roles get nothing.
--    The frontend only ever uses Supabase for Auth, never for table access.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke all on sequences from anon, authenticated;

-- 5. match_chunks: backend only, and immune to search_path tricks.
--    `public` stays on the path because pgvector's <=> operator lives there.
alter function match_chunks(vector, uuid, integer) set search_path = public, pg_temp;
revoke execute on function match_chunks(vector, uuid, integer) from public, anon, authenticated;
grant execute on function match_chunks(vector, uuid, integer) to service_role;

-- 6. Storage refuses oversized objects itself, matching the API's 10MB.
update storage.buckets set file_size_limit = 10485760 where id = 'documents';

commit;
