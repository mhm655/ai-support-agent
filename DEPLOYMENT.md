# Deployment guide

Backend on Railway, frontend on Vercel. Both are configured to deploy straight
from the `mhm655/ai-support-agent` GitHub repo, each service pointed at its
own subdirectory (`backend/` or `frontend/`).

Order matters: deploy the backend first so you have its public URL before
configuring the frontend, then come back and update the backend's
`CORS_ORIGINS` once you know the frontend's real URL.

## 1. Backend → Railway

1. Go to [railway.com](https://railway.com) and sign in with GitHub.
2. **New Project → Deploy from GitHub repo** → select `mhm655/ai-support-agent`.
3. Once the service is created, open it and go to **Settings**:
   - **Root Directory**: `backend`
   - Railway will pick up `backend/railway.json` automatically (start
     command, health check on `/health`) and `backend/.python-version`
     (pins Python 3.13) — no other build config needed.
4. Go to **Variables** and add:
   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | from Supabase dashboard → Project Settings → API |
   | `SUPABASE_SECRET_KEY` | Supabase dashboard → API Keys → **Legacy** `service_role` key (see note below) |
   | `GEMINI_API_KEY` | your Gemini API key |
   | `CORS_ORIGINS` | `http://localhost:3000` for now — you'll update this in step 3 |

   > **Legacy key note**: this project's pinned `supabase-py` version only
   > validates the older `eyJ...`-style key format, not Supabase's newer
   > `sb_secret_...` format. Use the dashboard's "Legacy anon, service_role
   > API keys" tab. See `CLAUDE.md` for the full story if this changes.

5. Deploy. Once live, copy the public URL Railway gives the service
   (Settings → Networking → **Generate Domain** if it's not already public).
6. Verify: `https://<your-railway-domain>/health` should return `{"status":"ok"}`.

## 2. Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New → Project** → select `mhm655/ai-support-agent`.
3. In the import screen, set **Root Directory** to `frontend`. Vercel
   auto-detects Next.js — no other build config needed.
4. Add environment variables (**Settings → Environment Variables**, or during
   import):
   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | same Supabase project URL as the backend |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase dashboard → API Keys → **Legacy** `anon` key |
   | `NEXT_PUBLIC_API_URL` | the Railway URL from step 1 (e.g. `https://your-app.up.railway.app`) |
5. Deploy. Copy the resulting `https://<your-app>.vercel.app` URL.

## 3. Close the loop: update backend CORS

Go back to Railway → your backend service → **Variables** → set
`CORS_ORIGINS` to your real Vercel URL (e.g.
`https://your-app.vercel.app`), then redeploy. This is what lets the
dashboard (not the embeddable widget — that's intentionally open to `*`,
see `main.py`) actually talk to the API from production.

## 4. Supabase Auth: production URL

Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL** → your Vercel URL. This is what confirmation-email links
  point to; leaving it as `localhost` means signup confirmation emails
  send users to a dead link in production.

## 5. Smoke test in production

1. Sign up a fresh account at your Vercel URL, create an agent, upload a
   document, confirm it reaches `status: done`.
2. Test chat in the dashboard's Test Chat tab.
3. Confirm the embeddable widget works: `https://<your-vercel-url>/widget.js`
   should load, and you can drop it into any static HTML page with
   `data-agent-id` and `data-api-url` pointing at your Railway backend (see
   `frontend/public/widget.js` header comment for the exact snippet).

## Notes / known constraints

- **Gemini free tier persists into production** — `gemini-3.5-flash-lite`'s
  free-tier daily quota applies per API key regardless of environment. If
  you outgrow it, the fix is a Google Cloud billing account on the same
  project, not a code change.
- **Railway's free trial is usage-based credit, not indefinite** — check
  Railway's current pricing before leaving this running long-term.
- Supabase Storage bucket `documents` must already exist (see `CLAUDE.md`)
  — this is unrelated to which environment is calling it, so if local dev
  works, production will too.
