"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import AuthLayout from "@/components/AuthLayout";
import { FormError, PasswordField, TextField } from "@/components/FormField";
import { SpinnerIcon } from "@/lib/icons";

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <AuthLayout
      title="Create your account"
      subtitle="Set up your business and build your first agent."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="focus-ring rounded font-medium text-cream underline decoration-amber/60 underline-offset-4 transition hover:text-amber"
          >
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4" noValidate>
        <TextField
          label="Business name"
          autoComplete="organization"
          required
          placeholder="Northside Dental"
          value={businessName}
          onChange={setBusinessName}
        />

        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
        />

        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={6}
        />

        {error && <FormError>{error}</FormError>}

        <button type="submit" disabled={loading} className="btn btn-primary mt-2 w-full">
          {loading && <SpinnerIcon />}
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>
    </AuthLayout>
  );
}
