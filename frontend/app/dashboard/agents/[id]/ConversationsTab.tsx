"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Conversation, Message } from "./types";

export default function ConversationsTab({ agentId }: { agentId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Conversation[]>(`/agents/${agentId}/conversations`)
      .then(setConversations)
      .finally(() => setLoading(false));
  }, [agentId]);

  async function openConversation(id: string) {
    setSelected(id);
    const data = await apiFetch<Message[]>(`/conversations/${id}/messages`);
    setMessages(data);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-ink/10 bg-ink/5" />
        ))}
      </div>
    );
  }

  if (selected) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="mb-4 text-sm text-slate-onlight underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40"
        >
          ← Back to conversations
        </button>
        <div className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-white p-4">
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "self-end" : "self-start"}>
              <span
                className={`inline-block max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user" ? "bg-amber text-ink" : "bg-ink/5 text-ink"
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

  if (conversations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink/15 px-6 py-10 text-center">
        <p className="font-display font-bold text-ink">No conversations yet</p>
        <p className="mt-1 text-sm text-slate-onlight">
          Chats from your test panel or the embedded widget will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {conversations.map((c) => (
        <li key={c.id}>
          <button
            onClick={() => openConversation(c.id)}
            className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-left text-sm transition hover:border-amber/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40"
          >
            <p className="font-medium text-ink">Visitor {c.visitor_id?.slice(0, 12) || "unknown"}</p>
            <p className="text-slate-onlight">{new Date(c.created_at).toLocaleString()}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}
