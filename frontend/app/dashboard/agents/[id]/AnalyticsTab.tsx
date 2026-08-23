"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Analytics } from "./types";

export default function AnalyticsTab({ agentId }: { agentId: string }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    apiFetch<Analytics>(`/agents/${agentId}/analytics`).then(setAnalytics);
  }, [agentId]);

  if (!analytics) {
    return (
      <div className="grid grid-cols-2 gap-4" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-ink/10 bg-ink/5" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Conversations", value: analytics.conversation_count },
    { label: "Messages", value: analytics.message_count },
    { label: "Leads captured", value: analytics.lead_count },
    { label: "Documents", value: analytics.document_count },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-ink/10 bg-white p-4">
          <p className="font-display text-2xl font-bold tabular-nums text-ink">{card.value}</p>
          <p className="text-sm text-slate-onlight">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
