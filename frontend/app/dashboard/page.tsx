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
import {
  ArrowRightIcon,
  ChatIcon,
  CodeIcon,
  DocumentIcon,
  PencilIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from "@/lib/icons";

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

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-[104px]" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <GettingStarted />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {agents.map((agent, i) => (
              <li
                key={agent.id}
                className="card enter group relative flex items-center gap-4 p-5 transition duration-200 hover:border-amber/40 hover:bg-well/60 focus-within:border-amber/40"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <span
                  aria-hidden="true"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber/25 bg-amber/10 font-display text-base font-bold text-amber"
                >
                  {agent.name.trim().charAt(0).toUpperCase() || "?"}
                </span>

                <span className="min-w-0 flex-1">
                  {/* Stretched link: the whole card is the click target, but
                      the anchor stays a plain link with the row actions
                      layered above it — nesting buttons inside an <a> would
                      be invalid and unusable by keyboard. */}
                  <Link
                    href={`/dashboard/agents/${agent.id}`}
                    className="focus-ring rounded before:absolute before:inset-0 before:content-['']"
                  >
                    <span className="block truncate font-medium text-cream">{agent.name}</span>
                  </Link>
                  <span className="block font-mono text-[11px] text-dusk">
                    Created {new Date(agent.created_at).toLocaleDateString()}
                  </span>
                </span>

                <span className="relative z-10 flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setRenaming(agent)}
                    aria-label={`Rename ${agent.name}`}
                    className="focus-ring rounded-lg p-2 text-dusk transition hover:bg-cream/5 hover:text-cream"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(agent)}
                    aria-label={`Delete ${agent.name}`}
                    className="focus-ring rounded-lg p-2 text-dusk transition hover:bg-rose/10 hover:text-rose"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="ml-1 h-4 w-4 text-dusk transition group-hover:translate-x-0.5 group-hover:text-amber"
                  />
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
    icon: PlusIcon,
    title: "Create an agent",
    body: "Name it above. Most businesses only ever need one.",
  },
  {
    icon: DocumentIcon,
    title: "Upload a document",
    body: "Your hours, prices, or policies as a PDF, .txt or .md. Everything it says comes from here.",
  },
  {
    icon: CodeIcon,
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
 */
function GettingStarted() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-line bg-well/50 px-5 py-3.5">
        <ChatIcon className="h-4 w-4 text-amber" />
        <span className="text-[13px] font-medium text-cream">Getting started</span>
        <span className="ml-auto font-mono text-[11px] text-dusk">about 5 minutes</span>
      </div>
      <ol className="divide-y divide-line">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-start gap-4 p-5">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-well font-mono text-[12px] text-amber"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="font-display text-[15px] font-bold tracking-tight text-cream">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-mist">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
