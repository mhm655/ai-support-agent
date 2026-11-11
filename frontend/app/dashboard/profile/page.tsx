"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import PageHeading from "@/components/PageHeading";
import Skeleton from "@/components/Skeleton";
import { FormError } from "@/components/FormField";
import { useToast } from "@/components/Toast";
import { CheckIcon, SpinnerIcon } from "@/lib/icons";

type Business = {
  id: string;
  name: string;
  created_at: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const toast = useToast();
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
      toast({ title: "Business name updated" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save changes";
      setError(message);
      toast({ tone: "error", title: "Couldn't save changes", description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell width="max-w-3xl">
      <PageHeading title="Profile" description="Your account and business details." />

      {loading ? (
        <div className="mt-8 flex flex-col gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-10">
          {/* The account's facts as a plain list. This used to be an
              avatar tile plus two stat cards, each with its own icon tile.
              Name and email are left to the form below, which shows them
              anyway; listing them twice on one screen was noise. */}
          <dl className="divide-y divide-edge border-y border-edge">
            {[
              { term: "Agents", value: agentCount },
              {
                term: "Member since",
                value: business
                  ? new Date(business.created_at).toLocaleDateString([], {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Unknown",
              },
            ].map((row) => (
              <div key={row.term} className="grid grid-cols-1 gap-1 px-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="text-[14px] text-ink-muted">{row.term}</dt>
                <dd className="truncate text-[15px] font-medium text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="panel p-6">
            <h2 className="font-display text-[18px] font-bold text-ink">Business details</h2>

            <form onSubmit={handleSave} className="mt-5 flex flex-col gap-5" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={nameId} className="label">
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
                  className="field max-w-sm"
                />
                <span className="text-xs text-ink-faint">
                  Shown to you here; agents introduce themselves with their own name.
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="label">Email</span>
                <input
                  type="email"
                  disabled
                  aria-label="Email"
                  value={email ?? ""}
                  className="field max-w-sm"
                />
                <span className="text-xs text-ink-faint">
                  Your login email can&apos;t be changed here.
                </span>
              </div>

              {error && <FormError>{error}</FormError>}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving || !name.trim() || name === business?.name}
                  className="btn btn-primary"
                >
                  {saving && <SpinnerIcon />}
                  {saving ? "Saving…" : "Save changes"}
                </button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-good">
                    <CheckIcon className="h-4 w-4" />
                    Saved
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
