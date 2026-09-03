"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { streamChat } from "@/lib/chat";
import StatusDot from "@/components/StatusDot";
import { AlertIcon, SendIcon } from "@/lib/icons";
import type { ChatMessage, Document } from "./types";

const SUGGESTIONS = ["What are your hours?", "Do you take Cigna?", "How much does a cleaning cost?"];

// Talks to the SAME public endpoint the embeddable widget uses — this is
// the fastest way to test an agent works, using the real code path.
export default function TestChatTab({ agentId }: { agentId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // null while unknown, so the warning below doesn't flash before the
  // document list has actually come back.
  const [readyDocs, setReadyDocs] = useState<number | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  // Lazy useState initializer, not useRef(Math.random()) — calling an
  // impure function directly in the render body is flagged by the
  // react-hooks/purity rule; a lazy initializer is the sanctioned way to
  // run it exactly once per mount.
  const [visitorId] = useState(() => `preview-${Math.random().toString(36).slice(2)}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<Document[]>(`/agents/${agentId}/documents`)
      .then((docs) => setReadyDocs(docs.filter((d) => d.status === "done").length))
      .catch(() => setReadyDocs(null));
  }, [agentId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
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
    <div className="flex flex-col gap-3">
      {/* The most common confusion with this product is an agent that
          answers "I don't know" to everything — which is correct behaviour
          when nothing has been uploaded, but reads as broken. Say so before
          the user spends five minutes testing an empty knowledge base. */}
      {readyDocs === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-volt/30 bg-volt/[0.07] p-4">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-volt" />
          <p className="text-[13px] leading-relaxed text-ink">
            <span className="font-medium">No documents are ready yet.</span>{" "}
            <span className="text-ink-muted">
              This agent has nothing to answer from, so it will say it doesn&apos;t know. Upload one
              in the Documents tab first.
            </span>
          </p>
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-edge bg-paper-sunk/50 px-4 py-3">
          <StatusDot />
          <span className="text-[13px] font-medium text-ink">Preview</span>
          <span className="ml-auto font-mono text-[11px] text-ink-faint">same endpoint as the live widget</span>
        </div>

        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          className="flex h-[26rem] flex-col gap-3 overflow-y-auto p-5"
        >
          {messages.length === 0 ? (
            <div className="m-auto max-w-xs text-center">
              <p className="text-sm leading-relaxed text-ink-muted">
                Ask something a customer would ask. Answers come from the documents you uploaded.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className="focus-ring enter rounded-full border border-edge bg-paper-sunk px-3 py-1.5 text-[12.5px] text-ink-muted transition hover:-translate-y-px hover:border-volt/40 hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => {
              // An empty assistant bubble means the request is in flight: the
              // first token hasn't landed yet. Show a typing indicator rather
              // than an ellipsis that looks like part of the answer.
              const pending = m.role === "assistant" && m.text === "";
              return (
                <div key={i} className={`enter ${m.role === "user" ? "self-end" : "self-start"}`}>
                  <span
                    className={`inline-block max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-2xl rounded-br-md bg-volt font-medium text-white"
                        : "rounded-2xl rounded-bl-md border border-edge bg-paper-sunk text-ink"
                    }`}
                  >
                    {pending ? <TypingDots /> : m.text}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input.trim());
          }}
          className="flex gap-2 border-t border-edge bg-paper-sunk/30 p-3"
        >
          <label htmlFor="test-chat-input" className="sr-only">
            Ask something a customer might ask
          </label>
          <input
            id="test-chat-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something a customer might ask…"
            className="field flex-1 rounded-full"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send message"
            className="btn btn-primary h-10 w-10 p-0"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </form>
      </div>

      {messages.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setMessages([]);
            conversationIdRef.current = null;
            inputRef.current?.focus();
          }}
          className="focus-ring self-start rounded text-[13px] text-ink-faint transition hover:text-ink"
        >
          Start a new conversation
        </button>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Agent is typing">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-dusk"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
