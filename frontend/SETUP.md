# Frontend additions — auth + first dashboard slice

## 1. Install the one new dependency

```bash
cd frontend
npm install @supabase/supabase-js
```

## 2. Copy these files into your existing `frontend/` project

This zip mirrors your `frontend/` folder structure — copy everything into
place, merging with what's already there (nothing here should overwrite
existing files from `create-next-app`, except possibly `app/page.tsx` if
you want the landing page to link to `/login` / `/signup`, which isn't
included here — that's your landing page work).

```
frontend/
├── lib/
│   ├── supabase/client.ts   ← new
│   └── api.ts                  ← new
└── app/
    ├── (auth)/
    │   ├── login/page.tsx      ← new
    │   └── signup/page.tsx     ← new
    └── dashboard/page.tsx      ← new
```

## 3. Set up env vars

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
— the same two values from your `backend/.env`, just the publishable one,
not the secret. `NEXT_PUBLIC_API_URL` should already be right for local dev.

## 4. Confirm the `@/` import alias works

`create-next-app` sets this up by default (check `tsconfig.json` has
`"paths": { "@/*": ["./*"] }`). If your imports like `@/lib/api` show as
errors, that config is missing — tell me and I'll give you the fix.

## 5. Run both servers

```bash
# terminal 1
cd backend && uvicorn app.main:app --reload --port 8000

# terminal 2
cd frontend && npm run dev
```

## 6. Test the full flow

1. Go to `http://localhost:3000/signup`
2. Enter a business name, email, password → submit
3. If Supabase has email confirmation ON (default), you'll be told to check
   your email — confirm it, then go to `/login` instead and sign in there
   (the login page creates the missing `businesses` row automatically on
   first login in that case)
4. You should land on `/dashboard`
5. Type an agent name, click **Create agent**
6. It should appear in the list below

If it appears — that's the full stack working end to end: Next.js →
Supabase Auth → JWT → FastAPI → Supabase Postgres → back to the UI.

## If you want to skip email confirmation for faster local testing

Supabase dashboard → **Authentication → Providers → Email** → toggle off
"Confirm email". Turn it back on before treating this as production-like.

## Known rough edges (intentional, for now)

- No middleware-based route protection yet — `/dashboard` checks for a
  session client-side and redirects if missing. Fine for MVP, worth
  revisiting later.
- No password reset / email templates styled — default Supabase behavior.
- Zero visual design — this is the functional skeleton. Once the
  login → agent → chat → widget flow all works, that's the right time to
  actually design the UI properly rather than styling scaffolding that
  might get restructured.
