"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import PageHeading from "@/components/PageHeading";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { FormError } from "@/components/FormField";
import { ArrowRightIcon, ChatIcon, PlusIcon, SpinnerIcon } from "@/lib/icons";

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

  return (
    <DashboardShell>
      <PageHeading
        eyebrow="Workspace"
        title="Your agents"
        description="Each agent keeps its own knowledge base and answers as a separate assistant."
      />

      <form onSubmit={handleCreateAgent} className="card mt-8 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <label htmlFor="new-agent-name" className="sr-only">
          New agent name
        </label>
        <input
          id="new-agent-name"
          type="text"
          placeholder="Name a new agent — e.g. Front desk assistant"
          value={newAgentName}
          onChange={(e) => setNewAgentName(e.target.value)}
          className="field flex-1"
        />
        <button
          type="submit"
          disabled={creating || !newAgentName.trim()}
          className="btn btn-primary sm:w-auto"
        >
          {creating ? <SpinnerIcon /> : <PlusIcon />}
          {creating ? "Creating…" : "Create agent"}
        </button>
      </form>

      {error && (
        <div className="mt-4">
          <FormError>{error}</FormError>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-[104px]" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <EmptyState
            icon={<ChatIcon className="h-5 w-5" />}
            title="No agents yet"
            description="Create one above, upload a document, and it will start answering customer questions from your own words."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {agents.map((agent) => (
              <li key={agent.id}>
                <Link
                  href={`/dashboard/agents/${agent.id}`}
                  className="card focus-ring group flex h-full items-center gap-4 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-amber/40 hover:bg-well/60"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber/25 bg-amber/10 font-display text-base font-bold text-amber"
                  >
                    {agent.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-cream">{agent.name}</span>
                    <span className="block font-mono text-[11px] text-dusk">
                      Created {new Date(agent.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-dusk transition group-hover:translate-x-0.5 group-hover:text-amber" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
