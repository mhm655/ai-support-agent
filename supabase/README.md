# Supabase schema

`migrations/` holds the Postgres schema — tables, indexes, the pgvector
setup, and the `match_chunks` similarity-search RPC — reconstructed from how
`backend/app/` actually queries the database. During development the schema
was applied by hand via the Supabase dashboard SQL editor, so this migration
is a retroactive snapshot, not something the running production project was
deployed from.

RLS is enabled on every table but no policies are defined (see the comment
at the top of the migration for why — the FastAPI backend is the real
authorization boundary here, not Postgres policies).

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
