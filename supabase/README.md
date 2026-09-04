# Supabase schema

`migrations/` holds the Postgres schema — tables, indexes, the pgvector
setup, and the `match_chunks` similarity-search RPC — reconstructed from how
`backend/app/` actually queries the database. During development the schema
was applied by hand via the Supabase dashboard SQL editor, so this migration
is a retroactive snapshot, not something the running production project was
deployed from.

Because it is a reconstruction rather than an export, it drifted from
production and was reconciled on 2026-09-04. The reconstruction had invented
a `document_chunks.agent_id` column that production does not have and that
`rag_pipeline.process_document` never writes, so a fresh project provisioned
from the old file would have failed every document upload on a not-null
violation. **The direction of reconciliation was "the file follows
production":** nothing was changed in the live database. The migration's
own header records what was verified against production and what was not —
notably the index list and the RLS/grant state could not be checked, since
PostgREST does not expose them.

RLS is enabled on every table but no policies are defined (see the comment
at the top of the migration for why — the FastAPI backend is the real
authorization boundary here, not Postgres policies).

Adding a table later means re-running the `GRANT ALL ... TO service_role`
statements at the bottom of the migration. Without them, every backend query
against the new table fails with `permission denied for table X`, even
though `service_role` is supposed to bypass RLS entirely.

## Applying to a fresh Supabase project

1. Create a new Supabase project.
2. Dashboard → SQL Editor → paste the contents of
   `migrations/20260903000000_initial_schema.sql` → Run.
   (Or, with the [Supabase CLI](https://supabase.com/docs/guides/cli) linked
   to the project: `supabase db push`.)
3. Dashboard → Storage → create a new **private** bucket named exactly
   `documents`.
4. Fill in `backend/.env` / `frontend/.env.local` with the new project's URL
   and keys (see `backend/.env.example` / `frontend/.env.local.example`).

See the root [README.md](../README.md) and [ARCHITECTURE.md](../ARCHITECTURE.md)
for the rest of the setup (Gemini API key, running the apps locally).
