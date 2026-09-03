"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { apiFetch, ApiError } from "@/lib/api";
import AuthLayout from "@/components/AuthLayout";
import { FormError, PasswordField, TextField } from "@/components/FormField";
import { SpinnerIcon } from "@/lib/icons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <AuthLayout
      title="Log in"
      subtitle="Welcome back."
      footer={
        <>
          No account?{" "}
          <Link
            href="/signup"
            className="focus-ring rounded font-medium text-cream underline decoration-amber/60 underline-offset-4 transition hover:text-amber"
          >
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4" noValidate>
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
        />

        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />

        {error && <FormError>{error}</FormError>}

        <button type="submit" disabled={loading} className="btn btn-primary mt-2 w-full">
          {loading && <SpinnerIcon />}
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
