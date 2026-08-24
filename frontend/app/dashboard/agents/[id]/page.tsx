"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { ChatIcon, ChartIcon, ConversationIcon, DocumentIcon, UserIcon } from "@/lib/icons";
import { TABS, type Tab } from "./types";
import TestChatTab from "./TestChatTab";
import DocumentsTab from "./DocumentsTab";
import LeadsTab from "./LeadsTab";
import ConversationsTab from "./ConversationsTab";
import AnalyticsTab from "./AnalyticsTab";

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  "Test chat": <ChatIcon />,
  Documents: <DocumentIcon />,
  Leads: <UserIcon />,
  Conversations: <ConversationIcon />,
  Analytics: <ChartIcon />,
};

export default function AgentDetailPage() {
  const { id: agentId } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("Test chat");
  const [agentName, setAgentName] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ name: string }>(`/agents/${agentId}`)
      .then((agent) => setAgentName(agent.name))
      .catch(() => setAgentName(null));
  }, [agentId]);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/10">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-onlight underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40"
          >
            ← Your agents
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {agentName ? (
          <h1 className="font-display text-2xl font-bold text-ink">{agentName}</h1>
        ) : (
          <div className="h-8 w-48 animate-pulse rounded bg-ink/10" aria-hidden="true" />
        )}

        <div role="tablist" className="mt-6 flex gap-1 overflow-x-auto border-b border-ink/10">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40 ${
                tab === t
                  ? "border-amber font-medium text-ink"
                  : "border-transparent text-slate-onlight hover:text-ink"
              }`}
            >
              {TAB_ICONS[t]}
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "Test chat" && <TestChatTab agentId={agentId} />}
          {tab === "Documents" && <DocumentsTab agentId={agentId} />}
          {tab === "Leads" && <LeadsTab agentId={agentId} />}
          {tab === "Conversations" && <ConversationsTab agentId={agentId} />}
          {tab === "Analytics" && <AnalyticsTab agentId={agentId} />}
        </div>
      </main>
    </div>
  );
}
