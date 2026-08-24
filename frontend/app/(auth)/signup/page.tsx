"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) throw signUpError;

      // If email confirmation is required, there's no session yet — the
      // businesses row gets created on first login instead (see login page).
      if (data.session) {
        await apiFetch("/businesses/", {
          method: "POST",
          body: JSON.stringify({ name: businessName }),
        });
        router.push("/dashboard");
      } else {
        setError("Check your email to confirm your account, then log in.");
      }
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
        <h1 className="text-xl font-bold text-ink">Create your account</h1>
        <p className="mt-1 text-sm text-slate-onlight">
          Set up your business and start building an agent.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={nameId} className="text-sm font-medium text-ink">
              Business name
            </label>
            <input
              id={nameId}
              type="text"
              autoComplete="organization"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-onlight/60 focus-visible:border-amber focus-visible:ring-2 focus-visible:ring-amber/40"
            />
          </div>

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
              autoComplete="new-password"
              spellCheck={false}
              required
              minLength={6}
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
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-onlight">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-ink underline underline-offset-2 hover:text-amber">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
