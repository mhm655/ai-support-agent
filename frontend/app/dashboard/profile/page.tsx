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
import { CheckIcon, ChatIcon, ClockIcon, SpinnerIcon, UserIcon } from "@/lib/icons";

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
      <PageHeading eyebrow="Account" title="Profile" description="Your account and business details." />

      {loading ? (
        <div className="mt-8 flex flex-col gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {/* Identity card. The amber ring makes the avatar read as the
              account's anchor rather than a decorative circle. */}
          <div className="card flex items-center gap-5 p-6">
            <span
              aria-hidden="true"
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-amber/25 bg-amber/10 text-amber"
            >
              <UserIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold tracking-tight text-cream">
                {business?.name}
              </p>
              <p className="truncate text-sm text-mist">{email}</p>
            </div>
          </div>

          {/* At-a-glance stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="card flex items-center gap-4 p-5">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-well text-amber"
              >
                <ChatIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-2xl font-bold tabular-nums text-cream">{agentCount}</p>
                <p className="text-sm text-dusk">
                  agent{agentCount === 1 ? "" : "s"} configured
                </p>
              </div>
            </div>

            <div className="card flex items-center gap-4 p-5">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-well text-amber"
              >
                <ClockIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-lg font-bold text-cream">
                  {business ? new Date(business.created_at).toLocaleDateString() : "—"}
                </p>
                <p className="text-sm text-dusk">member since</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-display text-base font-bold tracking-tight text-cream">Business details</h2>

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
                <span className="text-xs text-dusk">
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
                <span className="text-xs text-dusk">
                  Managed through your Supabase account, not editable here.
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
                  <span className="flex items-center gap-1.5 text-sm text-emerald">
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
