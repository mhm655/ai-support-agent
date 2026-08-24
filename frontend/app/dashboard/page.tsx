"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import { SpinnerIcon, UserIcon } from "@/lib/icons";

type Agent = {
  id: string;
  name: string;
  personality: string | null;
  instructions: string | null;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAgentName, setNewAgentName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      loadAgents();
    });
  }, [router]);

  async function loadAgents() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Agent[]>("/agents/");
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!newAgentName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await apiFetch("/agents/", {
        method: "POST",
        body: JSON.stringify({ name: newAgentName }),
      });
      setNewAgentName("");
      await loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="font-display text-lg font-bold text-ink">
            frontdesk<span className="text-amber">.ai</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/profile"
              aria-label="Profile"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink transition hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40"
            >
              <UserIcon />
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-full border border-ink/15 px-4 py-1.5 text-sm font-medium text-ink transition hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-ink">Your agents</h1>
        <p className="mt-1 text-sm text-slate-onlight">
          Each agent has its own knowledge base and answers as a separate assistant.
        </p>

        <form onSubmit={handleCreateAgent} className="mt-6 flex gap-2">
          <label htmlFor="new-agent-name" className="sr-only">
            New agent name
          </label>
          <input
            id="new-agent-name"
            type="text"
            placeholder="e.g. Front desk assistant…"
            value={newAgentName}
            onChange={(e) => setNewAgentName(e.target.value)}
            className="flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-onlight/60 focus-visible:border-amber focus-visible:ring-2 focus-visible:ring-amber/40"
          />
          <button
            type="submit"
            disabled={creating || !newAgentName.trim()}
            className="flex shrink-0 items-center gap-2 rounded-full bg-amber px-4 py-2 text-sm font-medium text-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating && <SpinnerIcon />}
            {creating ? "Creating…" : "Create agent"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-4 text-sm text-rose">
            {error}
          </p>
        )}

        <div className="mt-8">
          {loading ? (
            <div className="flex flex-col gap-3" aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-ink/10 bg-ink/5" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink/15 px-6 py-12 text-center">
              <p className="font-bold text-ink">No agents yet</p>
              <p className="mt-1 text-sm text-slate-onlight">
                Create one above to start answering customer questions from your own documents.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {agents.map((agent) => (
                <li key={agent.id}>
                  <Link
                    href={`/dashboard/agents/${agent.id}`}
                    className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3.5 transition hover:border-amber/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber/15 text-sm font-bold text-amber"
                    >
                      {agent.name.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <span>
                      <p className="font-medium text-ink">{agent.name}</p>
                      <p className="text-sm text-slate-onlight">
                        Created {new Date(agent.created_at).toLocaleDateString()}
                      </p>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
