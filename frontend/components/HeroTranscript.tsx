"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { streamChat } from "@/lib/chat";
import StatusDot from "@/components/StatusDot";
import { ArrowRightIcon, CheckIcon, SendIcon } from "@/lib/icons";

type Line = { role: "user" | "assistant"; text: string };

const SCRIPT: Line[] = [
  { role: "user", text: "Do you accept Cigna insurance?" },
  { role: "assistant", text: "Yes — we're in-network with Cigna PPO plans. Want help booking a visit?" },
  { role: "user", text: "Can I come in next Tuesday?" },
  { role: "assistant", text: "There's a 2:30pm opening Tuesday. Can I grab your name and email to hold it?" },
];

const TYPE_MS = 16;
const PAUSE_MS = 520;
const LOOP_MS = 3200;

/*
 * The hero panel. It plays a scripted conversation as an attract loop, and
 * — when a demo agent is configured — the input at the bottom is real: the
 * first thing a visitor types takes over the panel and hits the same public
 * chat endpoint the embedded widget uses.
 *
 * That's the strongest possible demonstration of this particular product,
 * because the claim being made ("it answers from your documents") is the one
 * thing a static screenshot can't support. With no demo agent configured it
 * degrades to the loop plus a link, rather than pretending to be live.
 */
export default function HeroTranscript({ demoAgentId }: { demoAgentId?: string }) {
  const [live, setLive] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Replay state, only meaningful while `live` is false.
  const [visibleCount, setVisibleCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // The typewriter is driven by timers, not CSS, so the global
  // prefers-reduced-motion rule can't switch it off — it has to be checked
  // here. When set, the scripted conversation is shown complete and still.
  const [reduced, setReduced] = useState(false);

  const conversationIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visitorId] = useState(() => `hero-${Math.random().toString(36).slice(2)}`);

  const scriptFinished = reduced || visibleCount >= SCRIPT.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Deferred a tick so this isn't a synchronous state write from the
    // effect body, and re-checked if the OS setting changes mid-visit.
    const sync = () => setReduced(mq.matches);
    const t = setTimeout(sync, 0);
    mq.addEventListener("change", sync);
    return () => {
      clearTimeout(t);
      mq.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (live || reduced) return;
    if (scriptFinished) {
      const reset = setTimeout(() => {
        setVisibleCount(0);
        setCharCount(0);
      }, LOOP_MS);
      return () => clearTimeout(reset);
    }
    const currentText = SCRIPT[visibleCount].text;
    if (charCount < currentText.length) {
      const t = setTimeout(() => setCharCount((c) => c + 1), TYPE_MS);
      return () => clearTimeout(t);
    }
    const advance = setTimeout(() => {
      setVisibleCount((v) => v + 1);
      setCharCount(0);
    }, PAUSE_MS);
    return () => clearTimeout(advance);
  }, [live, reduced, visibleCount, charCount, scriptFinished]);

  useEffect(() => {
    if (live) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, live]);

  const send = useCallback(
    async (text: string) => {
      if (!demoAgentId || !text || sending) return;
      setLive(true);
      setInput("");
      setSending(true);
      setLines((prev) => [...prev, { role: "user", text }, { role: "assistant", text: "" }]);

      const fail = (message: string) =>
        setLines((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", text: message };
          return copy;
        });

      try {
        await streamChat(demoAgentId, text, conversationIdRef.current, visitorId, {
          onConversationId: (id) => {
            conversationIdRef.current = id;
          },
          onToken: (delta) =>
            setLines((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = {
                role: "assistant",
                text: copy[copy.length - 1].text + delta,
              };
              return copy;
            }),
          onError: fail,
        });
      } catch {
        fail("Couldn't reach the demo agent just now. The dashboard demo still works.");
      } finally {
        setSending(false);
      }
    },
    [demoAgentId, sending, visitorId]
  );

  const shown: Line[] = live
    ? lines
    : reduced
      ? SCRIPT
      : SCRIPT.slice(0, visibleCount + 1).map((msg, i) =>
          i === visibleCount ? { ...msg, text: msg.text.slice(0, charCount) } : msg
        );

  const typingIndex = live
    ? lines.findIndex((l) => l.role === "assistant" && l.text === "")
    : reduced
      ? -1
      : visibleCount;

  return (
    <div className="relative w-full max-w-sm">
      {!live && (
        <p className="sr-only">
          An example conversation: a visitor asks whether the practice accepts Cigna insurance and
          whether they can come in on Tuesday. The agent confirms it is in-network, offers a 2:30pm
          Tuesday opening, and asks for a name and email — capturing the lead.
        </p>
      )}

      {/* Accent bloom behind the panel so it reads as lit rather than pasted on. */}
      <div aria-hidden="true" className="absolute -inset-8 -z-10 rounded-full bg-amber/10 blur-3xl" />

      <div className="card overflow-hidden" style={{ boxShadow: "var(--shadow-lift)" }}>
        <div className="flex items-center gap-2.5 border-b border-line bg-well/60 px-4 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-amber/15 font-display text-xs font-bold text-amber">
            {live ? "?" : "N"}
          </span>
          <span className="text-[13px] font-medium text-cream">
            {live ? "Live demo agent" : "Northside Dental"}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <StatusDot />
            <span className="font-mono text-[10px] uppercase tracking-widest text-dusk">
              {live ? "live" : "demo"}
            </span>
          </span>
        </div>

        <div
          ref={scrollRef}
          // The looping script is decoration and is described by the
          // sr-only paragraph above; once it's a real conversation the
          // transcript becomes a live region worth announcing.
          aria-hidden={!live}
          role={live ? "log" : undefined}
          aria-live={live ? "polite" : undefined}
          className="flex h-[248px] flex-col justify-end gap-2.5 overflow-y-auto p-4"
        >
          {shown.map((msg, i) => {
            const typing = i === typingIndex && (live ? msg.text === "" : charCount < SCRIPT[i]?.text.length);
            return (
              <div key={i} className={msg.role === "user" ? "self-end" : "self-start"}>
                <p
                  className={`max-w-[230px] px-3.5 py-2 text-[13px] leading-snug ${
                    msg.role === "user"
                      ? "rounded-2xl rounded-br-md bg-amber font-medium text-void"
                      : "rounded-2xl rounded-bl-md border border-line bg-well text-cream"
                  }`}
                >
                  {msg.text}
                  {typing && !live && <span className="ml-px inline-block w-[2px] animate-pulse">▍</span>}
                  {typing && live && (
                    <span className="flex items-center gap-1 py-1" aria-label="Agent is typing">
                      {[0, 150, 300].map((d) => (
                        <span
                          key={d}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-dusk"
                          style={{ animationDelay: `${d}ms` }}
                        />
                      ))}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>

        {demoAgentId ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input.trim());
            }}
            className="flex items-center gap-2 border-t border-line p-3"
          >
            <label htmlFor="hero-chat" className="sr-only">
              Ask the demo agent a question
            </label>
            <input
              id="hero-chat"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={live ? "Ask another…" : "Try it — ask about hours or insurance"}
              className="field flex-1 rounded-full py-2 text-[12.5px]"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="btn btn-primary h-9 w-9 shrink-0 p-0"
            >
              <SendIcon className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <div className="border-t border-line p-3">
            <Link
              href="/demo"
              className="focus-ring flex items-center justify-between rounded-full border border-line bg-well px-3.5 py-2 text-[12.5px] text-mist transition hover:border-amber/40 hover:text-cream"
            >
              Ask it something yourself
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Fires once the scripted conversation reaches the point where the
          agent asks for contact details — the actual product outcome. Hidden
          once a real conversation takes over, since no lead was captured. */}
      <div
        aria-hidden="true"
        className={`absolute -bottom-5 -left-4 flex items-center gap-2 rounded-full border border-emerald/30 bg-card px-3.5 py-2 text-[12px] font-medium text-cream transition-all duration-500 sm:-left-10 ${
          scriptFinished && !live ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
        style={{ boxShadow: "var(--shadow-lift)" }}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald/15 text-emerald">
          <CheckIcon className="h-3.5 w-3.5" />
        </span>
        Lead captured
      </div>
    </div>
  );
}
