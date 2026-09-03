"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { FormError } from "@/components/FormField";
import { UserIcon } from "@/lib/icons";
import type { Lead } from "./types";

export default function LeadsTab({ agentId }: { agentId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Lead[]>(`/agents/${agentId}/leads`)
      .then(setLeads)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leads"))
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[86px]" />
        ))}
      </div>
    );
  }

  if (error) return <FormError>{error}</FormError>;

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={<UserIcon className="h-5 w-5" />}
        title="No leads yet"
        description="They'll show up here the moment a chat produces a name, email, or phone number."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {leads.map((lead) => {
        const contact = [lead.email, lead.phone].filter(Boolean).join(" · ");
        return (
          <li key={lead.id} className="card flex items-start gap-4 p-4">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber/25 bg-amber/10 font-display text-sm font-bold text-amber"
            >
              {lead.name?.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-cream">{lead.name || "(no name given)"}</p>
              <p className="truncate font-mono text-[12px] text-mist">
                {contact || "No contact info given"}
              </p>
              {lead.interest && (
                <p className="mt-2 rounded-lg border border-line bg-well px-3 py-2 text-[13px] leading-relaxed text-mist">
                  {lead.interest}
                </p>
              )}
            </div>
            <time
              dateTime={lead.created_at}
              className="shrink-0 font-mono text-[11px] whitespace-nowrap text-dusk"
            >
              {new Date(lead.created_at).toLocaleDateString()}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
