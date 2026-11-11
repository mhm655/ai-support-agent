"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import SearchField from "@/components/SearchField";
import { FormError } from "@/components/FormField";
import type { Lead } from "./types";

export default function LeadsTab({ agentId }: { agentId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiFetch<Lead[]>(`/agents/${agentId}/leads`)
      .then(setLeads)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leads"))
      .finally(() => setLoading(false));
  }, [agentId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((lead) =>
      [lead.name, lead.email, lead.phone, lead.interest].some((field) =>
        field?.toLowerCase().includes(q)
      )
    );
  }, [leads, query]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[92px]" />
        ))}
      </div>
    );
  }

  if (error) return <FormError>{error}</FormError>;

  if (leads.length === 0) {
    return (
      <EmptyState
        title="No leads yet"
        description="They'll show up here the moment a chat produces a name, email, or phone number."
      />
    );
  }

  return (
    <div>
      {/* Only worth showing once the list is long enough that scanning it
          stops being instant. */}
      {leads.length > 4 && (
        <SearchField
          value={query}
          onChange={setQuery}
          label="Search leads"
          placeholder="Search by name, email, phone or interest…"
          resultCount={filtered.length}
          totalCount={leads.length}
          noun="lead"
        />
      )}

      {filtered.length === 0 ? (
        <p className="border-t border-edge py-10 text-[15px] text-ink-muted">
          No leads match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        // One row per lead, divided rather than boxed: every lead is the same
        // kind of thing, so none needs lifting above the others. What they
        // asked for is set as plain text under their details, not inside a
        // grey box, since it is the most useful thing on the row.
        <ul className="divide-y divide-edge border-y border-edge">
          {filtered.map((lead) => (
            <li key={lead.id} className="flex items-start gap-6 px-1 py-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-semibold text-ink">
                  {lead.name || "No name given"}
                </p>
                {lead.email || lead.phone ? (
                  <p className="mt-0.5 flex flex-wrap gap-x-4 text-[14px] text-ink-muted">
                    {/* A captured email is the point of the product: make it
                        one click to act on rather than something to select
                        and copy by hand. */}
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="focus-ring rounded underline decoration-edge-strong underline-offset-4 transition hover:text-volt hover:decoration-volt"
                      >
                        {lead.email}
                      </a>
                    )}
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="focus-ring rounded underline decoration-edge-strong underline-offset-4 transition hover:text-volt hover:decoration-volt"
                      >
                        {lead.phone}
                      </a>
                    )}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[14px] text-ink-faint">No contact details given</p>
                )}
                {lead.interest && (
                  <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-ink">{lead.interest}</p>
                )}
              </div>
              <time
                dateTime={lead.created_at}
                className="shrink-0 pt-1 text-[13px] whitespace-nowrap text-ink-faint"
              >
                {new Date(lead.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
