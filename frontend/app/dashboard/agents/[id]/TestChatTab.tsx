"use client";

import { useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/chat";
import type { ChatMessage } from "./types";

// Talks to the SAME public endpoint the embeddable widget uses — this is
// the fastest way to test an agent works, using the real code path.
export default function TestChatTab({ agentId }: { agentId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  // Lazy useState initializer, not useRef(Math.random()) — calling an
  // impure function directly in the render body is flagged by the
  // react-hooks/purity rule; a lazy initializer is the sanctioned way to
  // run it exactly once per mount.
  const [visitorId] = useState(() => `preview-${Math.random().toString(36).slice(2)}`);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "assistant", text: "" }]);

    try {
      await streamChat(agentId, text, conversationIdRef.current, visitorId, {
        onConversationId: (id) => {
          conversationIdRef.current = id;
        },
        onToken: (delta) => {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: "assistant",
              text: copy[copy.length - 1].text + delta,
            };
            return copy;
          });
        },
        onError: (message) => {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", text: message };
            return copy;
          });
        },
      });
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", text: "Couldn't reach the agent. Try again." };
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        className="mb-4 flex h-96 flex-col gap-3 overflow-y-auto rounded-xl border border-ink/10 bg-white p-4"
      >
        {messages.length === 0 && (
          <p className="text-sm text-slate-onlight">
            Send a message to test this agent as a customer would see it.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "self-end" : "self-start"}>
            <span
              className={`inline-block max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user" ? "bg-amber text-ink" : "bg-ink/5 text-ink"
              }`}
            >
              {m.text || "…"}
            </span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="flex gap-2">
        <label htmlFor="test-chat-input" className="sr-only">
          Ask something a customer might ask
        </label>
        <input
          id="test-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something a customer might ask…"
          className="flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-onlight/60 focus-visible:border-amber focus-visible:ring-2 focus-visible:ring-amber/40"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-full bg-amber px-4 py-2 text-sm font-medium text-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
