"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
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

  useEffect(() => {
    apiFetch<Conversation[]>(`/agents/${agentId}/conversations`)
      .then(setConversations)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load conversations"))
      .finally(() => setLoading(false));
  }, [agentId]);

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
    return (
      <div>
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

        <div className="card flex flex-col gap-3 p-5">
          {loadingThread && <p className="text-sm text-dusk">Loading transcript…</p>}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "self-end" : "self-start"}>
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
          ))}
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
    <ul className="flex flex-col gap-2">
      {conversations.map((c) => (
        <li key={c.id}>
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
  );
}
