"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import { ConfirmDialog, PromptDialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import { ArrowLeftIcon } from "@/lib/icons";
import { TABS, type Tab } from "./types";
import TestChatTab from "./TestChatTab";
import SettingsTab from "./SettingsTab";
import DocumentsTab from "./DocumentsTab";
import LeadsTab from "./LeadsTab";
import ConversationsTab from "./ConversationsTab";
import AnalyticsTab from "./AnalyticsTab";

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
        className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-faint transition hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Your agents
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        {agentName ? (
          <h1 className="display text-[2.25rem] text-ink sm:text-[2.75rem]">{agentName}</h1>
        ) : (
          <div className="skeleton h-11 w-64 rounded-[var(--radius-control)] bg-paper-sunk" aria-hidden="true" />
        )}
        {/* The "live" badge that sat here is gone: every agent showed it
            whether or not it was embedded anywhere, so it was a decorative
            dot rather than a state. */}
        <span className="flex items-center gap-4 pb-1 text-[13px]">
          <button
            type="button"
            onClick={() => setRenaming(true)}
            disabled={!agentName}
            className="focus-ring rounded text-ink-muted transition hover:text-ink disabled:opacity-40"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => setDeleting(true)}
            disabled={!agentName}
            className="focus-ring rounded text-ink-muted transition hover:text-bad disabled:opacity-40"
          >
            Delete
          </button>
        </span>
      </div>

      {/* Underline tab bar, text only. Scrolls horizontally on narrow
          screens rather than wrapping into a ragged second row. The pill
          bar with an icon on every tab, active one filled blue, was the
          stock component-library look. */}
      {/* The hairline is an inset shadow on the tab list rather than a
          border that the active tab overlaps with -mb-px: that 1px overlap
          counted as vertical overflow in the scroll container and drew a
          stray scrollbar arrow. The tab's own 2px underline paints over the
          shadow, so the effect is the same. */}
      <div className="mt-8 -mx-5 overflow-x-auto overflow-y-hidden px-5 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label="Agent sections"
          onKeyDown={handleTabKeyDown}
          className="flex w-max min-w-full gap-7 shadow-[inset_0_-1px_0_var(--color-edge)]"
        >
          {TABS.map((t) => {
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
                className={`focus-ring shrink-0 border-b-2 pt-1 pb-3 text-[14px] whitespace-nowrap transition ${
                  selected
                    ? "border-volt font-medium text-ink"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
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
        className="focus-ring enter mt-8 rounded-[var(--radius-control)]"
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
