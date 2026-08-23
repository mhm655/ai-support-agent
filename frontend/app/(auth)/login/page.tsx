"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { apiFetch, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailId = useId();
  const passwordId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      // Confirm a businesses row exists — it won't yet if signup required
      // email confirmation (see signup page). This is a one-time repair,
      // not the normal path.
      try {
        await apiFetch("/businesses/me");
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          const name = window.prompt("What's your business name?");
          if (name) {
            await apiFetch("/businesses/", {
              method: "POST",
              body: JSON.stringify({ name }),
            });
          }
        } else {
          throw err;
        }
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-12">
      <Link href="/" className="mb-8 font-display text-lg font-bold text-ink">
        frontdesk<span className="text-amber">.ai</span>
      </Link>

      <div className="w-full max-w-sm rounded-xl border border-ink/10 bg-white p-8 shadow-sm">
        <h1 className="font-display text-xl font-bold text-ink">Log in</h1>
        <p className="mt-1 text-sm text-slate-onlight">Welcome back.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={emailId} className="text-sm font-medium text-ink">
              Email
            </label>
            <input
              id={emailId}
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-onlight/60 focus-visible:border-amber focus-visible:ring-2 focus-visible:ring-amber/40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={passwordId} className="text-sm font-medium text-ink">
              Password
            </label>
            <input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              spellCheck={false}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-onlight/60 focus-visible:border-amber focus-visible:ring-2 focus-visible:ring-amber/40"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-rose">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-full bg-amber px-4 py-2.5 text-sm font-medium text-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-onlight">
          No account?{" "}
          <Link href="/signup" className="font-medium text-ink underline underline-offset-2 hover:text-amber">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
