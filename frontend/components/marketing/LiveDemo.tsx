"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/chat";
import { SendIcon } from "@/lib/icons";

type Line = { role: "user" | "assistant"; text: string };

/*
 * The real demo agent, in the hero. Nothing here is scripted.
 *
 * This replaces HeroPanel, which played a typed-out dental conversation
 * ("Do you accept Cigna insurance?") until a visitor typed. The demo agent
 * is NOVA, a fictional property firm, and cannot answer that question, so
 * the hero was showing a conversation the product could not have. A
 * made-up product UI is also the most recognisable tell of a generated
 * landing page. The honest version starts empty and says what it is.
 *
 * The starters are questions NOVA's two documents actually answer (the same
 * ones the /demo page suggests), so the first click lands on a real,
 * grounded reply rather than an "I don't have that information".
 */
const STARTERS = [
  "What's for rent in Chicago?",
  "Anything in Boston under $4M?",
  "How do I book a viewing?",
];

export default function LiveDemo({ agentId }: { agentId: string }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Lazy initializer: Math.random in the render body breaks purity rules.
  const [visitorId] = useState(() => `hero-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  // Replaces the text of the reply currently being written.
  function setReply(update: (text: string) => string) {
    setLines((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, text: update(last.text) };
      return copy;
    });
  }

  async function ask(text: string) {
    const question = text.trim();
    if (!question || sending) return;
    setInput("");
    setSending(true);
    setLines((prev) => [...prev, { role: "user", text: question }, { role: "assistant", text: "" }]);

    try {
      await streamChat(agentId, question, conversationIdRef.current, visitorId, {
        onConversationId: (id) => {
          conversationIdRef.current = id;
        },
        onToken: (delta) => setReply((t) => t + delta),
        onError: (message) => setReply(() => message),
      });
    } catch {
      setReply(() => "Couldn't reach the demo agent just now. Try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <div className="flex h-[22rem] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-edge bg-paper-raised shadow-[var(--shadow-3)] sm:h-[26rem]">
      <div className="border-b border-edge px-5 py-4">
        <p className="font-display text-[15px] font-bold text-ink">Ask NOVA Properties</p>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          A real agent for a sample business. It only knows two documents.
        </p>
      </div>

      <div ref={scrollRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {lines.length === 0 ? (
          <div className="flex h-full flex-col justify-end gap-2">
            {STARTERS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className="focus-ring self-start rounded-full border border-edge-strong px-4 py-2 text-left text-[14px] text-ink transition hover:border-volt hover:text-volt active:scale-[0.98]"
              >
                {q}
              </button>
            ))}
          </div>
        ) : (
          lines.map((line, i) =>
            line.role === "user" ? (
              <p
                key={i}
                className="ml-auto w-fit max-w-[85%] rounded-[18px] rounded-br-[6px] bg-volt px-4 py-2.5 text-[14px] leading-snug text-white"
              >
                {line.text}
              </p>
            ) : (
              <p key={i} className="max-w-[92%] text-[15px] leading-relaxed text-ink">
                {line.text || <span className="text-ink-faint">Checking the documents…</span>}
              </p>
            )
          )
        )}
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-edge px-3 py-3">
        <label htmlFor="live-demo-input" className="sr-only">
          Ask NOVA Properties a question
        </label>
        <input
          id="live-demo-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="Ask your own question"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-[var(--radius-control)] bg-transparent px-2 py-2 text-[15px] text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-volt"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="btn btn-volt h-10 w-10 p-0"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
