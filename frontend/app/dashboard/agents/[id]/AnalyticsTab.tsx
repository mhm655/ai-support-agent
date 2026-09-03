"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Skeleton from "@/components/Skeleton";
import AnimatedNumber from "@/components/AnimatedNumber";
import { FormError } from "@/components/FormField";
import { ChartIcon, ConversationIcon, DocumentIcon, UserIcon } from "@/lib/icons";
import type { Analytics } from "./types";

export default function AnalyticsTab({ agentId }: { agentId: string }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Analytics>(`/agents/${agentId}/analytics`)
      .then(setAnalytics)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analytics"));
  }, [agentId]);

  if (error) return <FormError>{error}</FormError>;

  if (!analytics) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Conversations", value: analytics.conversation_count, icon: ConversationIcon },
    { label: "Messages", value: analytics.message_count, icon: ChartIcon },
    { label: "Leads captured", value: analytics.lead_count, icon: UserIcon, highlight: true },
    { label: "Documents", value: analytics.document_count, icon: DocumentIcon },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card, i) => (
        <div
          key={card.label}
          style={{ animationDelay: `${i * 60}ms` }}
          // The highlight is carried by the border and icon tile only. An
          // amber tint on the card background replaces bg-card rather than
          // layering over it, which makes the "important" card the darkest
          // one on the row — the opposite of the intent.
          className={`card enter p-5 ${card.highlight ? "border-amber/40" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`grid h-9 w-9 place-items-center rounded-xl border ${
              card.highlight ? "border-amber/30 bg-amber/15 text-amber" : "border-line bg-well text-mist"
            }`}
          >
            <card.icon className="h-4.5 w-4.5" />
          </span>
          <AnimatedNumber
            value={card.value}
            className="mt-4 block font-display text-[32px] leading-none font-bold tabular-nums text-cream"
          />
          <p className="mt-2 text-[13px] text-dusk">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
