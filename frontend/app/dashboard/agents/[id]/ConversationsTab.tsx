"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import SearchField from "@/components/SearchField";
import { FormError } from "@/components/FormField";
import { ArrowLeftIcon } from "@/lib/icons";
import type { Conversation, Message } from "./types";

// "Sep 24, 10:26 AM". The date is what an owner scans a list of chats by;
// the visitor id is a random string that means nothing to them, so it is
// shown small beside it rather than as the headline of each row.
function formatWhen(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ConversationsTab({ agentId }: { agentId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiFetch<Conversation[]>(`/agents/${agentId}/conversations`)
      .then(setConversations)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load conversations"))
      .finally(() => setLoading(false));
  }, [agentId]);

  // Matches against the date as displayed, so what you can see is what
  // you can search for.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.visitor_id?.toLowerCase().includes(q) || formatWhen(c.created_at).toLowerCase().includes(q)
    );
  }, [conversations, query]);

  async function openConversation(id: string) {
    setSelected(id);
    setMessages([]);
    setLoadingThread(true);
    setError(null);
    try {
      setMessages(await apiFetch<Message[]>(`/conversations/${id}/messages`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load this conversation");
    } finally {
      setLoadingThread(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[60px]" />
        ))}
      </div>
    );
  }

  if (selected) {
    const conversation = conversations.find((c) => c.id === selected);
    return (
      <div className="enter">
        <button
          onClick={() => {
            setSelected(null);
            setError(null);
          }}
          className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-muted transition hover:text-ink"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          All conversations
        </button>

        {error && (
          <div className="mt-4">
            <FormError>{error}</FormError>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="font-display text-[22px] font-bold text-ink">
            {conversation ? formatWhen(conversation.created_at) : "Conversation"}
          </h2>
          <span className="text-[13px] text-ink-faint">
            {messages.length} message{messages.length === 1 ? "" : "s"}
            {conversation?.visitor_id && <> · {conversation.visitor_id.slice(0, 24)}</>}
          </span>
        </div>

        {/* A transcript, not a chat window. Bubbles suit the person typing;
            an owner reading back a finished conversation is reading a
            record, and a speaker column scans faster. */}
        {loadingThread ? (
          <div className="mt-6 flex flex-col gap-3 border-t border-edge pt-6">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-10 w-1/2" />
          </div>
        ) : (
          <ol className="mt-6 divide-y divide-edge border-y border-edge">
            {messages.map((m) => (
              <li key={m.id} className="grid grid-cols-1 gap-1 py-5 sm:grid-cols-[6.5rem_1fr] sm:gap-6">
                <span
                  className={`text-[13px] font-medium ${m.role === "user" ? "text-volt" : "text-ink-muted"}`}
                >
                  {m.role === "user" ? "Visitor" : "Agent"}
                </span>
                <p className="max-w-[65ch] text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
                  {m.content}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  if (error) return <FormError>{error}</FormError>;

  if (conversations.length === 0) {
    return (
      <EmptyState
        title="No conversations yet"
        description="Chats from the test panel or the embedded widget will appear here, transcript and all."
      />
    );
  }

  return (
    <div>
      {conversations.length > 4 && (
        <SearchField
          value={query}
          onChange={setQuery}
          label="Search conversations"
          placeholder="Search by date or visitor…"
          resultCount={filtered.length}
          totalCount={conversations.length}
          noun="conversation"
        />
      )}

      {filtered.length === 0 ? (
        <p className="border-t border-edge py-10 text-[15px] text-ink-muted">
          No conversations match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="divide-y divide-edge border-y border-edge">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => openConversation(c.id)}
                className="focus-ring group flex w-full items-baseline gap-4 px-1 py-4 text-left transition hover:bg-paper-sunk/60"
              >
                <span className="text-[15px] font-medium text-ink transition group-hover:text-volt">
                  {formatWhen(c.created_at)}
                </span>
                <span className="min-w-0 truncate text-[13px] text-ink-faint">
                  {c.visitor_id?.slice(0, 20) || "unknown visitor"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
