"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Lead } from "./types";

export default function LeadsTab({ agentId }: { agentId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Lead[]>(`/agents/${agentId}/leads`)
      .then(setLeads)
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-ink/10 bg-ink/5" />
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink/15 px-6 py-10 text-center">
        <p className="font-bold text-ink">No leads yet</p>
        <p className="mt-1 text-sm text-slate-onlight">
          They&apos;ll show up here once a chat results in a name, email, or phone number.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {leads.map((lead) => (
        <li key={lead.id} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm">
          <p className="font-medium text-ink">{lead.name || "(no name given)"}</p>
          <p className="text-slate-onlight">
            {[lead.email, lead.phone].filter(Boolean).join(" · ") || "No contact info given"}
          </p>
          {lead.interest && <p className="mt-1 text-ink">{lead.interest}</p>}
        </li>
      ))}
    </ul>
  );
}
