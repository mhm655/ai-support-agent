"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import { SpinnerIcon, UserIcon } from "@/lib/icons";

type Business = {
  id: string;
  name: string;
  created_at: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const nameId = useId();

  const [business, setBusiness] = useState<Business | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const [biz, agents] = await Promise.all([
        apiFetch<Business>("/businesses/me"),
        apiFetch<unknown[]>("/agents/"),
      ]);
      setBusiness(biz);
      setName(biz.name);
      setAgentCount(agents.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setEmail(session.user.email ?? null);
      loadProfile();
    });
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name === business?.name) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await apiFetch<Business>("/businesses/me", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setBusiness(updated);
      setName(updated.name);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/10">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-onlight underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40"
          >
            ← Your agents
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-ink">Profile</h1>
        <p className="mt-1 text-sm text-slate-onlight">Your account and business details.</p>

        {loading ? (
          <div className="mt-8 flex flex-col gap-4" aria-hidden="true">
            <div className="h-24 animate-pulse rounded-xl border border-ink/10 bg-ink/5" />
            <div className="h-40 animate-pulse rounded-xl border border-ink/10 bg-ink/5" />
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            <div className="flex items-center gap-4 rounded-xl border border-ink/10 bg-white p-6">
              <span
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber/15 text-amber"
              >
                <UserIcon className="h-6 w-6" />
              </span>
              <div>
                <p className="font-medium text-ink">{business?.name}</p>
                <p className="text-sm text-slate-onlight">{email}</p>
                {business && (
                  <p className="mt-1 text-xs text-slate-onlight">
                    Member since {new Date(business.created_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-ink/10 bg-white p-6">
              <h2 className="font-bold text-ink">Business details</h2>

              <form onSubmit={handleSave} className="mt-4 flex flex-col gap-4" noValidate>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={nameId} className="text-sm font-medium text-ink">
                    Business name
                  </label>
                  <input
                    id={nameId}
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setSaved(false);
                    }}
                    className="w-full max-w-sm rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-onlight/60 focus-visible:border-amber focus-visible:ring-2 focus-visible:ring-amber/40"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink">Email</span>
                  <input
                    type="email"
                    disabled
                    value={email ?? ""}
                    className="w-full max-w-sm cursor-not-allowed rounded-lg border border-ink/15 bg-ink/5 px-3 py-2 text-sm text-slate-onlight outline-none"
                  />
                  <span className="text-xs text-slate-onlight">
                    Managed through your Supabase account, not editable here.
                  </span>
                </div>

                {error && (
                  <p role="alert" className="text-sm text-rose">
                    {error}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving || !name.trim() || name === business?.name}
                    className="flex items-center gap-2 rounded-full bg-amber px-4 py-2 text-sm font-medium text-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving && <SpinnerIcon />}
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                  {saved && <span className="text-sm text-emerald">Saved</span>}
                </div>
              </form>
            </div>

            <div className="rounded-xl border border-ink/10 bg-white p-6">
              <h2 className="font-bold text-ink">Overview</h2>
              <p className="mt-2 text-sm text-slate-onlight">
                {agentCount} agent{agentCount === 1 ? "" : "s"} configured
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
