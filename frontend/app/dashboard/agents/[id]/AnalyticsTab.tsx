"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Skeleton from "@/components/Skeleton";
import { FormError } from "@/components/FormField";
import type { Analytics } from "./types";

/*
 * Four numbers in one row, set in the poster type and divided by
 * hairlines. This used to be four equal cards, each with an icon tile and a
 * number that counted up from zero on every visit: the stock stat-card row
 * of a generated dashboard. The counting in particular was pure decoration,
 * replaying every time the tab was opened.
 *
 * Leads come first because they are the number a business owner opens this
 * tab for; the rest are context.
 */
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
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  const stats = [
    { label: "Leads captured", value: analytics.lead_count, lead: true },
    { label: "Conversations", value: analytics.conversation_count },
    { label: "Messages", value: analytics.message_count },
    { label: "Documents", value: analytics.document_count },
  ];

  return (
    <dl className="grid grid-cols-2 gap-y-10 lg:grid-cols-4 lg:divide-x lg:divide-edge">
      {stats.map((stat, i) => (
        <div key={stat.label} className={i > 0 ? "lg:pl-8" : ""}>
          <dt className="text-[14px] text-ink-muted">{stat.label}</dt>
          <dd
            className={`display-poster mt-2 text-[clamp(3.5rem,6vw,5.5rem)] tabular-nums ${
              stat.lead ? "text-volt" : "text-ink"
            }`}
          >
            {stat.value.toLocaleString()}
          </dd>
        </div>
      ))}
    </dl>
  );
}
