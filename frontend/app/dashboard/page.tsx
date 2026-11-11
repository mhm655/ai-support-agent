"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import PageHeading from "@/components/PageHeading";
import Skeleton from "@/components/Skeleton";
import { FormError } from "@/components/FormField";
import { ConfirmDialog, PromptDialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import { PlusIcon, SpinnerIcon } from "@/lib/icons";

type Agent = {
  id: string;
  name: string;
  personality: string | null;
  instructions: string | null;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAgentName, setNewAgentName] = useState("");
  const [creating, setCreating] = useState(false);

  const [renaming, setRenaming] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState<Agent | null>(null);
  const [busy, setBusy] = useState(false);

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
      setAgents(await apiFetch<Agent[]>("/agents/"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAgent(e: React.FormEvent) {
    e.preventDefault();
    const name = newAgentName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const agent = await apiFetch<Agent>("/agents/", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNewAgentName("");
      toast({ title: "Agent created", description: "Next: upload a document it can answer from." });
      // You create an agent in order to configure it, so go straight there
      // rather than dropping the user back on a list to find it again.
      router.push(`/dashboard/agents/${agent.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
      setCreating(false);
    }
  }

  async function handleRename(name: string) {
    if (!renaming) return;
    setBusy(true);
    try {
      await apiFetch(`/agents/${renaming.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      setRenaming(null);
      await loadAgents();
      toast({ title: "Agent renamed" });
    } catch (err) {
      toast({
        tone: "error",
        title: "Couldn't rename agent",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiFetch(`/agents/${deleting.id}`, { method: "DELETE" });
      const name = deleting.name;
      setDeleting(null);
      await loadAgents();
      toast({ title: `Deleted "${name}"` });
    } catch (err) {
      toast({
        tone: "error",
        title: "Couldn't delete agent",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell>
      <PageHeading
        title="Your agents"
        description="Each agent keeps its own knowledge base and answers as a separate assistant."
      />

      <form onSubmit={handleCreateAgent} className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="new-agent-name" className="sr-only">
          New agent name
        </label>
        <input
          id="new-agent-name"
          type="text"
          placeholder="Name a new agent, e.g. Front desk assistant"
          value={newAgentName}
          onChange={(e) => setNewAgentName(e.target.value)}
          className="field flex-1"
        />
        <button type="submit" disabled={creating || !newAgentName.trim()} className="btn btn-primary sm:w-auto">
          {creating ? <SpinnerIcon /> : <PlusIcon />}
          {creating ? "Creating…" : "Create agent"}
        </button>
      </form>

      {error && (
        <div className="mt-4">
          <FormError>{error}</FormError>
        </div>
      )}

      <div className="mt-10">
        {loading ? (
          <div className="flex flex-col gap-2 border-t border-edge pt-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[72px]" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <GettingStarted />
        ) : (
          // A divided list rather than a grid of shadowed cards: every row
          // is the same kind of thing, so nothing needs lifting above the
          // rest, and a list scans top to bottom where a two-column grid
          // makes the eye zigzag.
          <ul className="divide-y divide-edge border-y border-edge">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="group relative flex items-center gap-6 px-1 py-5 transition hover:bg-paper-sunk/60 focus-within:bg-paper-sunk/60"
              >
                <span className="min-w-0 flex-1">
                  {/* Stretched link: the whole row is the click target, but
                      the anchor stays a plain link with the row actions
                      layered above it — nesting buttons inside an <a> would
                      be invalid and unusable by keyboard. */}
                  <Link
                    href={`/dashboard/agents/${agent.id}`}
                    className="focus-ring rounded before:absolute before:inset-0 before:content-['']"
                  >
                    <span className="block truncate font-display text-[20px] font-bold text-ink transition group-hover:text-volt">
                      {agent.name}
                    </span>
                  </Link>
                  <span className="mt-0.5 block text-[13px] text-ink-faint">
                    Created {new Date(agent.created_at).toLocaleDateString()}
                  </span>
                </span>

                <span className="relative z-10 flex shrink-0 items-center gap-4 text-[13px]">
                  <button
                    type="button"
                    onClick={() => setRenaming(agent)}
                    aria-label={`Rename ${agent.name}`}
                    className="focus-ring rounded text-ink-muted transition hover:text-ink"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(agent)}
                    aria-label={`Delete ${agent.name}`}
                    className="focus-ring rounded text-ink-muted transition hover:text-bad"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PromptDialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        onSubmit={handleRename}
        title="Rename agent"
        label="Agent name"
        initialValue={renaming?.name ?? ""}
        submitLabel="Rename"
        pending={busy}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={`Delete "${deleting?.name}"?`}
        description="Its documents, conversations and captured leads go with it. Any site still embedding this agent will stop getting answers. This can't be undone."
        confirmLabel="Delete agent"
        pending={busy}
      />
    </DashboardShell>
  );
}

const STEPS = [
  {
    title: "Create an agent",
    body: "Name it above. Most businesses only ever need one.",
  },
  {
    title: "Upload a document",
    body: "Your hours, prices, or policies as a PDF, .txt or .md. Everything it says comes from here.",
  },
  {
    title: "Paste one line on your site",
    body: "The agent's Settings tab gives you the script tag, filled in and ready to copy.",
  },
];

/*
 * Replaces a bare "No agents yet" panel. A brand-new account previously
 * landed on an empty box with no indication that uploading a document is
 * the step that actually makes the product work — which is the single
 * thing most likely to leave someone with an agent that answers "I don't
 * know" to everything.
 *
 * An ordered list is already numbered by its order; the 01/02/03 tiles
 * that used to sit beside each step said the same thing louder.
 */
function GettingStarted() {
  return (
    <div className="border-t border-edge pt-8">
      <p className="font-display text-[20px] font-bold text-ink">Getting started</p>
      <p className="mt-1 text-[14px] text-ink-faint">About five minutes.</p>
      <ol className="mt-6 flex flex-col gap-6">
        {STEPS.map((step) => (
          <li key={step.title} className="max-w-lg">
            <h3 className="text-[16px] font-semibold text-ink">{step.title}</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
