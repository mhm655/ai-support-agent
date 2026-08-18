"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";

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
    // Redirect to login if there's no session — this page assumes an
    // authenticated user. A proper route guard (middleware) can replace
    // this later; it's a client-side check for now.
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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your agents</h1>
        <button onClick={handleLogout} className="text-sm text-gray-600 underline">
          Log out
        </button>
      </div>

      <form onSubmit={handleCreateAgent} className="mb-8 flex gap-2">
        <input
          type="text"
          placeholder="New agent name"
          value={newAgentName}
          onChange={(e) => setNewAgentName(e.target.value)}
          className="flex-1 rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create agent"}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : agents.length === 0 ? (
        <p className="text-gray-500">No agents yet — create your first one above.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {agents.map((agent) => (
            <li key={agent.id} className="rounded border border-gray-200 px-4 py-3">
              <p className="font-medium">{agent.name}</p>
              <p className="text-sm text-gray-500">
                Created {new Date(agent.created_at).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
