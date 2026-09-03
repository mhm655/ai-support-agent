"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import SearchField from "@/components/SearchField";
import { FormError } from "@/components/FormField";
import { ArrowLeftIcon, ArrowRightIcon, ConversationIcon } from "@/lib/icons";
import type { Conversation, Message } from "./types";

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.visitor_id?.toLowerCase().includes(q) ||
        new Date(c.created_at).toLocaleString().toLowerCase().includes(q)
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
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[72px]" />
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
          className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded text-sm text-dusk transition hover:text-cream"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to conversations
        </button>

        {error && <FormError>{error}</FormError>}

        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-well/50 px-5 py-3">
            <span className="font-mono text-[12px] text-cream">
              {conversation?.visitor_id?.slice(0, 24) || "unknown visitor"}
            </span>
            {conversation && (
              <span className="font-mono text-[11px] text-dusk">
                {new Date(conversation.created_at).toLocaleString()}
              </span>
            )}
            <span className="ml-auto font-mono text-[11px] text-dusk">
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex flex-col gap-3 p-5">
            {loadingThread ? (
              <>
                <Skeleton className="h-10 w-2/3 self-start" />
                <Skeleton className="h-10 w-1/2 self-end" />
              </>
            ) : (
              messages.map((m, i) => (
                <div
                  key={m.id}
                  className={`enter ${m.role === "user" ? "self-end" : "self-start"}`}
                  style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                >
                  <span
                    className={`inline-block max-w-[80%] px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-2xl rounded-br-md bg-amber font-medium text-void"
                        : "rounded-2xl rounded-bl-md border border-line bg-well text-cream"
                    }`}
                  >
                    {m.content}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error) return <FormError>{error}</FormError>;

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<ConversationIcon className="h-5 w-5" />}
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
          placeholder="Search by visitor or date…"
          resultCount={filtered.length}
          totalCount={conversations.length}
          noun="conversation"
        />
      )}

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-bright bg-card/40 px-6 py-10 text-center text-sm text-dusk">
          No conversations match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((c, i) => (
            <li key={c.id} className="enter" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
              <button
                onClick={() => openConversation(c.id)}
                className="card focus-ring group flex w-full items-center gap-4 p-4 text-left transition hover:border-amber/40 hover:bg-well/60"
              >
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-well text-mist"
                >
                  <ConversationIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[13px] text-cream">
                    {c.visitor_id?.slice(0, 20) || "unknown visitor"}
                  </span>
                  <span className="block text-[13px] text-dusk">
                    {new Date(c.created_at).toLocaleString()}
                  </span>
                </span>
                <ArrowRightIcon className="h-4 w-4 shrink-0 text-dusk transition group-hover:translate-x-0.5 group-hover:text-amber" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
