"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import { ConfirmDialog, PromptDialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import {
  ArrowLeftIcon,
  ChatIcon,
  ChartIcon,
  ConversationIcon,
  DocumentIcon,
  PencilIcon,
  SettingsIcon,
  TrashIcon,
  UserIcon,
} from "@/lib/icons";
import { TABS, type Tab } from "./types";
import TestChatTab from "./TestChatTab";
import SettingsTab from "./SettingsTab";
import DocumentsTab from "./DocumentsTab";
import LeadsTab from "./LeadsTab";
import ConversationsTab from "./ConversationsTab";
import AnalyticsTab from "./AnalyticsTab";

const TAB_ICONS: Record<Tab, React.ComponentType<{ className?: string }>> = {
  "Test chat": ChatIcon,
  Settings: SettingsIcon,
  Documents: DocumentIcon,
  Leads: UserIcon,
  Conversations: ConversationIcon,
  Analytics: ChartIcon,
};

const slug = (t: Tab) => t.toLowerCase().replace(/\s+/g, "-");

export default function AgentDetailPage() {
  const { id: agentId } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("Test chat");
  const [agentName, setAgentName] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    apiFetch<{ name: string }>(`/agents/${agentId}`)
      .then((agent) => setAgentName(agent.name))
      .catch(() => setAgentName(null));
  }, [agentId]);

  // Arrow-key navigation between tabs, which the ARIA tabs pattern expects
  // and a plain row of buttons doesn't give you for free.
  function handleTabKeyDown(e: React.KeyboardEvent) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + delta + TABS.length) % TABS.length];
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  async function handleRename(name: string) {
    setBusy(true);
    try {
      await apiFetch(`/agents/${agentId}`, { method: "PATCH", body: JSON.stringify({ name }) });
      setAgentName(name);
      setRenaming(false);
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
    setBusy(true);
    try {
      await apiFetch(`/agents/${agentId}`, { method: "DELETE" });
      toast({ title: `Deleted "${agentName}"` });
      router.push("/dashboard");
    } catch (err) {
      toast({
        tone: "error",
        title: "Couldn't delete agent",
        description: err instanceof Error ? err.message : undefined,
      });
      setBusy(false);
    }
  }

  return (
    <DashboardShell>
      <Link
        href="/dashboard"
        className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-dusk transition hover:text-cream"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Your agents
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {agentName ? (
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-cream sm:text-3xl">
            {agentName}
          </h1>
        ) : (
          <div className="skeleton h-8 w-56 rounded-lg bg-card" aria-hidden="true" />
        )}
        <span className="badge border border-line bg-well text-dusk">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald" />
          live
        </span>

        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRenaming(true)}
            disabled={!agentName}
            aria-label="Rename agent"
            className="focus-ring rounded-lg p-2 text-dusk transition hover:bg-cream/5 hover:text-cream disabled:opacity-40"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleting(true)}
            disabled={!agentName}
            aria-label="Delete agent"
            className="focus-ring rounded-lg p-2 text-dusk transition hover:bg-rose/10 hover:text-rose disabled:opacity-40"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </span>
      </div>

      {/* Segmented tab bar. Scrolls horizontally on narrow screens rather
          than wrapping into a ragged second row. */}
      <div className="mt-6 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label="Agent sections"
          onKeyDown={handleTabKeyDown}
          className="inline-flex min-w-full gap-1 rounded-full border border-line bg-card p-1 sm:min-w-0"
        >
          {TABS.map((t) => {
            const Icon = TAB_ICONS[t];
            const selected = tab === t;
            return (
              <button
                key={t}
                ref={(el) => {
                  tabRefs.current[t] = el;
                }}
                role="tab"
                id={`tab-${slug(t)}`}
                aria-selected={selected}
                aria-controls={`panel-${slug(t)}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(t)}
                className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm whitespace-nowrap transition duration-200 ${
                  selected ? "bg-amber font-medium text-void" : "text-mist hover:bg-cream/5 hover:text-cream"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div
        // Keyed on the tab so switching re-mounts and replays the enter
        // animation, which makes the panel change read as a transition
        // rather than an instant content swap.
        key={tab}
        role="tabpanel"
        id={`panel-${slug(tab)}`}
        aria-labelledby={`tab-${slug(tab)}`}
        tabIndex={0}
        className="focus-ring enter mt-6 rounded-2xl"
      >
        {tab === "Test chat" && <TestChatTab agentId={agentId} />}
        {tab === "Settings" && <SettingsTab agentId={agentId} />}
        {tab === "Documents" && <DocumentsTab agentId={agentId} />}
        {tab === "Leads" && <LeadsTab agentId={agentId} />}
        {tab === "Conversations" && <ConversationsTab agentId={agentId} />}
        {tab === "Analytics" && <AnalyticsTab agentId={agentId} />}
      </div>

      <PromptDialog
        open={renaming}
        onClose={() => setRenaming(false)}
        onSubmit={handleRename}
        title="Rename agent"
        label="Agent name"
        initialValue={agentName ?? ""}
        submitLabel="Rename"
        pending={busy}
      />

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={handleDelete}
        title={`Delete "${agentName}"?`}
        description="Its documents, conversations and captured leads go with it. Any site still embedding this agent will stop getting answers. This can't be undone."
        confirmLabel="Delete agent"
        pending={busy}
      />
    </DashboardShell>
  );
}
