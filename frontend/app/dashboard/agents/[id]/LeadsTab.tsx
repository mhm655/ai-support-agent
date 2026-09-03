"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import SearchField from "@/components/SearchField";
import { FormError } from "@/components/FormField";
import { UserIcon } from "@/lib/icons";
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
        <p className="rounded-2xl border border-dashed border-line-bright bg-card/40 px-6 py-10 text-center text-sm text-dusk">
          No leads match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((lead, i) => {
            const contact = [lead.email, lead.phone].filter(Boolean).join(" · ");
            return (
              <li
                key={lead.id}
                className="card enter flex items-start gap-4 p-4"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              >
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber/25 bg-amber/10 font-display text-sm font-bold text-amber"
                >
                  {lead.name?.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-cream">{lead.name || "(no name given)"}</p>
                  {contact ? (
                    <p className="truncate font-mono text-[12px] text-mist">
                      {/* A captured email is the point of the product — make
                          it one click to act on rather than something to
                          select and copy by hand. */}
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="focus-ring rounded underline decoration-line-bright underline-offset-4 transition hover:text-amber"
                        >
                          {lead.email}
                        </a>
                      )}
                      {lead.email && lead.phone && " · "}
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="focus-ring rounded underline decoration-line-bright underline-offset-4 transition hover:text-amber"
                        >
                          {lead.phone}
                        </a>
                      )}
                    </p>
                  ) : (
                    <p className="font-mono text-[12px] text-dusk">No contact info given</p>
                  )}
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
      )}
    </div>
  );
}
