"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

/*
 * The retrieval step, drawn.
 *
 * Every AI product's landing page shows a chat bubble. Almost none show the
 * part that decides whether the answer is true: the similarity search that
 * picks which passages of the business's own documents the model is allowed
 * to answer from. That mechanism is this product's entire claim, so it gets
 * the page's one piece of real choreography.
 *
 * The sequence is scroll-triggered and steps once. Under reduced motion it
 * renders in its final state immediately, and if the observer never fires
 * the CSS leaves everything visible.
 */

const QUESTION = "Do you take Delta Dental?";

const PASSAGES = [
  {
    source: "insurance-accepted-2026.pdf",
    text: "In-network: Delta Dental PPO, Cigna PPO, Aetna, MetLife. Out-of-network claims filed on your behalf.",
    score: 0.89,
  },
  {
    source: "new-patient-policy.md",
    text: "New patients should bring a photo ID and their insurance card to the first visit.",
    score: 0.64,
  },
  {
    source: "price-list-2026.pdf",
    text: "Adult cleaning and exam, 145. Bitewing X-rays, 65. Emergency exam, 95.",
    score: 0.41,
  },
  {
    source: "office-hours-and-holidays.txt",
    text: "Monday to Thursday, 8am to 5pm. Friday, 8am to 1pm. Closed weekends and public holidays.",
    score: 0.22,
  },
];

const ANSWER =
  "Yes, we are in-network with Delta Dental PPO. Would you like me to find you an appointment?";

// Step 0 question, 1 scanning, 2 match locked, 3 answering, 4 settled.
const STEP_MS = [700, 1500, 700, 2200];

export default function RetrievalDiagram() {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const reduce = mounted && Boolean(prefersReduced);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  // Start only once the diagram is actually on screen, so the sequence is
  // not already over by the time it is scrolled to.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setStarted(true), 0);
      return () => clearTimeout(t);
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStarted(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started || reduce || step >= STEP_MS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS[step]);
    return () => clearTimeout(t);
  }, [started, reduce, step]);

  useEffect(() => {
    if (reduce) return;
    if (step < 3 || typed >= ANSWER.length) return;
    const t = setTimeout(() => setTyped((c) => c + 1), 18);
    return () => clearTimeout(t);
  }, [reduce, step, typed]);

  const shown = reduce ? 4 : step;
  const answerText = reduce ? ANSWER : ANSWER.slice(0, typed);

  return (
    <div ref={ref} className="grid grid-cols-1 gap-px bg-edge lg:grid-cols-[1fr_1.35fr_1fr]">
      {/* 1. The question ------------------------------------------------ */}
      <div className="flex flex-col justify-between bg-paper p-6 sm:p-8">
        <p className="label-mono text-ink-faint">Visitor asks</p>
        <p
          className={`mt-8 text-[19px] leading-snug font-medium transition-opacity duration-500 ${
            shown >= 1 ? "opacity-100" : "opacity-0"
          }`}
        >
          &ldquo;{QUESTION}&rdquo;
        </p>
        <p className="mt-8 font-mono text-[11px] text-ink-faint">
          {shown >= 1 ? "embedded to 1536 dimensions" : " "}
        </p>
      </div>

      {/* 2. The search -------------------------------------------------- */}
      <div className="bg-paper p-6 sm:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <p className="label-mono text-ink-faint">Your documents</p>
          <p className="font-mono text-[11px] text-ink-faint tabular-nums">
            {shown >= 2 ? "4 passages ranked" : shown >= 1 ? "searching" : " "}
          </p>
        </div>

        <ul className="mt-6 flex flex-col gap-2">
          {PASSAGES.map((p, i) => {
            const isTop = i === 0;
            const scanning = shown === 1;
            const locked = shown >= 2 && isTop;
            const dimmed = shown >= 2 && !isTop;
            return (
              <li
                key={p.source}
                style={{ transitionDelay: scanning ? `${i * 120}ms` : "0ms" }}
                className={`rounded-[4px] border p-3 transition-all duration-500 ${
                  locked
                    ? "border-volt bg-volt-wash"
                    : dimmed
                      ? "border-edge bg-paper opacity-45"
                      : "border-edge bg-paper-raised"
                } ${shown >= 1 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"} ${
                  dimmed ? "opacity-45" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-[11px] text-ink-muted">{p.source}</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums transition-colors duration-500 ${
                      locked ? "font-medium text-volt" : "text-ink-faint"
                    }`}
                  >
                    {shown >= 2 ? p.score.toFixed(2) : "····"}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{p.text}</p>
                {/* The similarity bar reads as a measurement, not decoration:
                    no filled background track, just the measured length. */}
                <div className="mt-2 h-px w-full bg-edge">
                  <div
                    className={`h-px transition-all duration-700 ${locked ? "bg-volt" : "bg-ink-faint"}`}
                    style={{ width: shown >= 2 ? `${p.score * 100}%` : "0%" }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 3. The answer -------------------------------------------------- */}
      <div className="flex flex-col justify-between bg-paper p-6 sm:p-8">
        <p className="label-mono text-ink-faint">Agent answers</p>
        <p className="mt-8 text-[17px] leading-snug">
          {answerText}
          {!reduce && shown >= 3 && typed < ANSWER.length && (
            <span className="ml-px inline-block w-[2px] animate-pulse text-volt">|</span>
          )}
        </p>
        <p
          className={`mt-8 font-mono text-[11px] transition-opacity duration-500 ${
            shown >= 3 ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="text-ink-faint">grounded in </span>
          <span className="text-volt">{PASSAGES[0].source}</span>
        </p>
      </div>
    </div>
  );
}
