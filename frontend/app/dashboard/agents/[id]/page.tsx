"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import {
  ArrowLeftIcon,
  ChatIcon,
  ChartIcon,
  ConversationIcon,
  DocumentIcon,
  SettingsIcon,
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
  const [tab, setTab] = useState<Tab>("Test chat");
  const [agentName, setAgentName] = useState<string | null>(null);
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

  return (
    <DashboardShell>
      <Link
        href="/dashboard"
        className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-dusk transition hover:text-cream"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Your agents
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        {agentName ? (
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-cream sm:text-3xl">
            {agentName}
          </h1>
        ) : (
          <div className="h-8 w-56 animate-pulse rounded-lg bg-card" aria-hidden="true" />
        )}
        <span className="badge border border-line bg-well text-dusk">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald" />
          live
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
                className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm whitespace-nowrap transition ${
                  selected
                    ? "bg-amber font-medium text-void"
                    : "text-mist hover:bg-cream/5 hover:text-cream"
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
        role="tabpanel"
        id={`panel-${slug(tab)}`}
        aria-labelledby={`tab-${slug(tab)}`}
        tabIndex={0}
        className="focus-ring mt-6 rounded-2xl"
      >
        {tab === "Test chat" && <TestChatTab agentId={agentId} />}
        {tab === "Settings" && <SettingsTab agentId={agentId} />}
        {tab === "Documents" && <DocumentsTab agentId={agentId} />}
        {tab === "Leads" && <LeadsTab agentId={agentId} />}
        {tab === "Conversations" && <ConversationsTab agentId={agentId} />}
        {tab === "Analytics" && <AnalyticsTab agentId={agentId} />}
      </div>
    </DashboardShell>
  );
}
