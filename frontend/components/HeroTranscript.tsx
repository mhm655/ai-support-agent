"use client";

import { useEffect, useState } from "react";
import StatusDot from "@/components/StatusDot";
import { CheckIcon } from "@/lib/icons";

const TRANSCRIPT: { role: "user" | "assistant"; text: string }[] = [
  { role: "user", text: "Do you accept Cigna insurance?" },
  { role: "assistant", text: "Yes — we're in-network with Cigna PPO plans. Want help booking a visit?" },
  { role: "user", text: "Can I come in next Tuesday?" },
  { role: "assistant", text: "There's a 2:30pm opening Tuesday. Can I grab your name and email to hold it?" },
];

const TYPE_MS = 16;
const PAUSE_MS = 520;
const LOOP_MS = 3200;

/*
 * The hero's replaying demo conversation. It's a marketing device, not real
 * UI, so the whole panel is hidden from assistive tech and replaced with a
 * static description of what it shows — a screen reader following a
 * character-by-character typewriter would just get noise.
 */
export default function HeroTranscript() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const finished = visibleCount >= TRANSCRIPT.length;

  useEffect(() => {
    if (finished) {
      const reset = setTimeout(() => {
        setVisibleCount(0);
        setCharCount(0);
      }, LOOP_MS);
      return () => clearTimeout(reset);
    }
    const currentText = TRANSCRIPT[visibleCount].text;
    if (charCount < currentText.length) {
      const t = setTimeout(() => setCharCount((c) => c + 1), TYPE_MS);
      return () => clearTimeout(t);
    }
    const advance = setTimeout(() => {
      setVisibleCount((v) => v + 1);
      setCharCount(0);
    }, PAUSE_MS);
    return () => clearTimeout(advance);
  }, [visibleCount, charCount, finished]);

  return (
    <div className="relative w-full max-w-sm">
      <p className="sr-only">
        An example conversation: a visitor asks whether the practice accepts Cigna insurance and
        whether they can come in on Tuesday. The agent confirms it is in-network, offers a 2:30pm
        Tuesday opening, and asks for a name and email — capturing the lead.
      </p>

      {/* Accent bloom behind the panel so it reads as lit rather than pasted on. */}
      <div
        aria-hidden="true"
        className="absolute -inset-8 -z-10 rounded-full bg-amber/10 blur-3xl"
      />

      <div aria-hidden="true" className="card overflow-hidden" style={{ boxShadow: "var(--shadow-lift)" }}>
        <div className="flex items-center gap-2.5 border-b border-line bg-well/60 px-4 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-amber/15 font-display text-xs font-bold text-amber">
            N
          </span>
          <span className="text-[13px] font-medium text-cream">Northside Dental</span>
          <span className="ml-auto flex items-center gap-1.5">
            <StatusDot />
            <span className="font-mono text-[10px] uppercase tracking-widest text-dusk">online</span>
          </span>
        </div>

        <div className="flex min-h-[248px] flex-col justify-end gap-2.5 p-4">
          {TRANSCRIPT.slice(0, visibleCount + 1).map((msg, i) => {
            const isCurrent = i === visibleCount;
            const text = isCurrent ? msg.text.slice(0, charCount) : msg.text;
            const typing = isCurrent && charCount < msg.text.length;
            return (
              <div key={i} className={msg.role === "user" ? "self-end" : "self-start"}>
                <p
                  className={`max-w-[230px] px-3.5 py-2 text-[13px] leading-snug ${
                    msg.role === "user"
                      ? "rounded-2xl rounded-br-md bg-amber font-medium text-void"
                      : "rounded-2xl rounded-bl-md border border-line bg-well text-cream"
                  }`}
                >
                  {text}
                  {typing && <span className="ml-px inline-block w-[2px] animate-pulse">▍</span>}
                </p>
              </div>
            );
          })}
        </div>

        <div className="border-t border-line px-4 py-3">
          <div className="rounded-full border border-line bg-well px-3.5 py-2 text-[12px] text-dusk">
            Ask about hours, pricing, insurance…
          </div>
        </div>
      </div>

      {/* Fires once the conversation reaches the point where the agent asks
          for contact details — the actual product outcome, not decoration. */}
      <div
        aria-hidden="true"
        className={`absolute -bottom-5 -left-4 flex items-center gap-2 rounded-full border border-emerald/30 bg-card px-3.5 py-2 text-[12px] font-medium text-cream transition-all duration-500 sm:-left-10 ${
          finished ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
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
