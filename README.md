# frontdesk.ai

An AI front desk for small businesses. A business uploads what they already
have — hours, pricing, policies, FAQs — and gets an AI agent that answers
customer questions grounded in that content, captures leads, and embeds on
their own site with one `<script>` tag.

**Live**: [ai-support-agent-liard.vercel.app](https://ai-support-agent-liard.vercel.app)

> A portfolio project, built end to end (backend, frontend, RAG pipeline,
> deployment) to explore a real retrieval-augmented generation product, not
> just a toy demo.

## What it does

- A business signs up, creates an agent, and uploads documents (PDF/txt/md)
  describing their business.
- Those documents are parsed, chunked, embedded, and stored in Postgres
  (pgvector).
- Customers chat with the agent — via the dashboard's test panel, or via the
  embeddable widget on the business's own site — and get answers grounded in
  the uploaded content, not generic guesses.
- If a customer shows interest in booking or being contacted, the agent
  captures their name/email/phone as a lead, automatically, mid-conversation.
- The business gets a dashboard: documents, leads, conversation history, and
  basic analytics.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router), Tailwind CSS v4, TypeScript |
| Backend | FastAPI, Python |
| Database / Auth / Storage | Supabase (Postgres + pgvector, Auth, Storage) |
| AI | Gemini (`gemini-3.5-flash-lite` for chat + function calling, `gemini-embedding-2` for embeddings) via the `google-genai` SDK |
| Hosting | Vercel (frontend + embeddable widget), Railway (backend API) |

## Architecture, briefly

Two apps, one Supabase project:

```
frontend/   Next.js dashboard (agent config, documents, leads, analytics)
            + the public embeddable widget (frontend/public/widget.js)
backend/    FastAPI — owns authorization and the RAG/chat pipeline
```

The backend is the authorization boundary — it verifies the Supabase JWT
per-request and scopes every query to the caller's business, rather than
relying on Supabase Row Level Security as the primary guard. The one
deliberately unauthenticated route is the public chat endpoint the
embeddable widget calls, since it has to work from a visitor's browser on a
completely different website with no Supabase session available.

RAG pipeline: upload → extract text → chunk → embed (Gemini) → store in
pgvector → similarity search against the visitor's question → grounded,
streamed reply, with lead capture running as a function-calling tool in the
same pass.

Full architectural detail, including the non-obvious decisions and the real
issues hit along the way (a Gemini free-tier quota wall, a Supabase key
format mismatch, an RLS grants gotcha), lives in [`CLAUDE.md`](CLAUDE.md).

## Running locally

Backend ([full instructions](backend/README.md)):

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env             # fill in Supabase + Gemini values
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
cp .env.local.example .env.local # fill in Supabase values
npm run dev
```

Needs a Supabase project with pgvector enabled, a private Storage bucket
named `documents`, and a Gemini API key — see `backend/.env.example` and
`frontend/.env.local.example` for the exact variables.

## Testing

Backend (pytest, fully offline — every Supabase/Gemini call is mocked):

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest
```

Frontend unit tests (Vitest + React Testing Library):

```bash
cd frontend
npm test
```

Frontend end-to-end tests (Playwright, runs against a production build with
no real backend — see `frontend/playwright.config.ts` for what that does and
doesn't cover):

```bash
cd frontend
npx playwright install --with-deps chromium   # first time only
npm run build
npm run test:e2e
```

## CI/CD

GitHub Actions runs on every push and pull request to `main`:

- [`.github/workflows/backend-ci.yml`](.github/workflows/backend-ci.yml) —
  installs backend deps on Python 3.11 and 3.12, then runs the pytest suite.
- [`.github/workflows/frontend-ci.yml`](.github/workflows/frontend-ci.yml) —
  lints, type-checks, runs unit tests, builds, then runs the Playwright e2e
  suite against that build.

Both only run when files under their respective app changed. Vercel and
Railway auto-deploy on push to `main` independently of these workflows — to
actually gate deploys on tests passing, turn on GitHub branch protection for
`main` requiring these checks (Settings → Branches → Branch protection
rules), so a broken PR can't be merged in the first place.

## Deploying

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full Vercel + Railway setup.
