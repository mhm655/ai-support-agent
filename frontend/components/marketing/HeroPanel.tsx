"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, PaperPlaneTilt } from "@phosphor-icons/react";
import { streamChat } from "@/lib/chat";

type Line = { role: "user" | "assistant"; text: string };

const SCRIPT: Line[] = [
  { role: "user", text: "Do you accept Cigna insurance?" },
  { role: "assistant", text: "Yes, we are in-network with Cigna PPO plans. Want help booking a visit?" },
  { role: "user", text: "Can I come in next Tuesday?" },
  { role: "assistant", text: "There is a 2:30pm opening Tuesday. Can I grab your name and email to hold it?" },
];

const TYPE_MS = 16;
const PAUSE_MS = 520;
const LOOP_MS = 3200;

/*
 * The hero's product preview. This is a real component, not a picture of
 * one: when a demo agent is configured the input is live and talks to the
 * same public endpoint the embedded widget uses, so what a visitor sees is
 * the actual product answering an actual question.
 *
 * Until someone types, it replays a scripted exchange as an attract loop.
 * With no demo agent configured it degrades to that loop plus a link,
 * rather than presenting a mock-up as though it were working software.
 */
export default function HeroPanel({ demoAgentId }: { demoAgentId?: string }) {
  const [live, setLive] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const prefersReduced = useReducedMotion();
  // useReducedMotion() resolves to a different value on the server than on
  // the client's first render. Anything that changes markup must wait until
  // after mount, or the two renders disagree and hydration fails.
  const [mounted, setMounted] = useState(false);
  const reduce = mounted && Boolean(prefersReduced);

  const conversationIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visitorId] = useState(() => `hero-${Math.random().toString(36).slice(2)}`);

  const scriptDone = reduce || visibleCount >= SCRIPT.length;

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  // The typewriter is driven by timers, not CSS, so the global reduced
  // motion rule cannot switch it off. It has to be checked here.
  useEffect(() => {
    if (live || reduce) return;
    if (visibleCount >= SCRIPT.length) {
      const reset = setTimeout(() => {
        setVisibleCount(0);
        setCharCount(0);
      }, LOOP_MS);
      return () => clearTimeout(reset);
    }
    const current = SCRIPT[visibleCount].text;
    if (charCount < current.length) {
      const t = setTimeout(() => setCharCount((c) => c + 1), TYPE_MS);
      return () => clearTimeout(t);
    }
    const advance = setTimeout(() => {
      setVisibleCount((v) => v + 1);
      setCharCount(0);
    }, PAUSE_MS);
    return () => clearTimeout(advance);
  }, [live, reduce, visibleCount, charCount]);

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
        fail("Could not reach the demo agent just now. Please try again in a moment.");
      } finally {
        setSending(false);
      }
    },
    [demoAgentId, sending, visitorId]
  );

  const shown: Line[] = live
    ? lines
    : reduce
      ? SCRIPT
      : SCRIPT.slice(0, visibleCount + 1).map((msg, i) =>
          i === visibleCount ? { ...msg, text: msg.text.slice(0, charCount) } : msg
        );

  return (
    <div className="relative w-full max-w-[26rem]">
      {!live && (
        <p className="sr-only">
          An example conversation. A visitor asks whether the practice accepts Cigna insurance and
          whether they can come in on Tuesday. The agent confirms it is in-network, offers a 2:30pm
          Tuesday opening, and asks for a name and email to hold it.
        </p>
      )}

      <div className="card overflow-hidden" style={{ boxShadow: "var(--shadow-lift)" }}>
        <div className="flex items-center gap-2.5 border-b border-line bg-well/60 px-4 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-amber/15 font-display text-xs font-bold text-amber">
            {live ? "F" : "N"}
          </span>
          <span className="text-[13px] font-medium text-cream">
            {live ? "Live demo agent" : "Northside Dental"}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            {/* Conveys real state: whether this preview is answering. */}
            <span className="relative flex h-2 w-2" aria-hidden="true">
              {!reduce && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-dusk">
              {live ? "live" : "demo"}
            </span>
          </span>
        </div>

        <div
          ref={scrollRef}
          aria-hidden={!live}
          role={live ? "log" : undefined}
          aria-live={live ? "polite" : undefined}
          className="flex h-[15.5rem] flex-col justify-end gap-2.5 overflow-y-auto p-4"
        >
          {shown.map((msg, i) => {
            const pending = live && msg.role === "assistant" && msg.text === "";
            const typing = !live && !reduce && i === visibleCount && charCount < SCRIPT[i].text.length;
            return (
              <div key={i} className={msg.role === "user" ? "self-end" : "self-start"}>
                <p
                  className={`max-w-[15rem] px-3.5 py-2 text-[13px] leading-snug ${
                    msg.role === "user"
                      ? "rounded-2xl rounded-br-md bg-amber font-medium text-void"
                      : "rounded-2xl rounded-bl-md border border-line bg-well text-cream"
                  }`}
                >
                  {msg.text}
                  {typing && <span className="ml-px inline-block w-[2px] animate-pulse">|</span>}
                  {pending && (
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
              placeholder={live ? "Ask another question" : "Ask it something yourself"}
              className="field flex-1 rounded-full py-2 text-[12.5px]"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="btn btn-primary h-9 w-9 shrink-0 p-0"
            >
              <PaperPlaneTilt weight="bold" className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <div className="border-t border-line p-3">
            <Link
              href="/demo"
              className="focus-ring flex items-center justify-between rounded-full border border-line bg-well px-3.5 py-2 text-[12.5px] text-mist transition hover:border-amber/40 hover:text-cream"
            >
              Ask it something yourself
              <ArrowRight weight="bold" className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Marks the moment the scripted exchange reaches a captured lead,
          which is the product outcome the page is selling. */}
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={scriptDone && !live ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -bottom-5 -left-3 flex items-center gap-2 rounded-full border border-emerald/30 bg-card px-3.5 py-2 text-[12px] font-medium text-cream sm:-left-8"
        style={{ boxShadow: "var(--shadow-lift)" }}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald/15 text-emerald">
          <Check weight="bold" className="h-3 w-3" />
        </span>
        Lead captured
      </motion.div>
    </div>
  );
}
