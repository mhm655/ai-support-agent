"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

const TRANSCRIPT: { role: "user" | "assistant"; text: string }[] = [
  { role: "user", text: "Do you accept Cigna insurance?" },
  { role: "assistant", text: "Yes — we're in-network with Cigna PPO plans. Would you like help booking a visit?" },
  { role: "user", text: "Can I come in next Tuesday?" },
  { role: "assistant", text: "We have a 2:30pm opening Tuesday. Can I grab your name and email to hold it?" },
];

function AnimatedTranscript() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= TRANSCRIPT.length) {
      const resetTimer = setTimeout(() => {
        setVisibleCount(0);
        setCharCount(0);
      }, 2200);
      return () => clearTimeout(resetTimer);
    }
    const currentText = TRANSCRIPT[visibleCount].text;
    if (charCount < currentText.length) {
      const t = setTimeout(() => setCharCount((c) => c + 1), 18);
      return () => clearTimeout(t);
    }
    const advance = setTimeout(() => {
      setVisibleCount((v) => v + 1);
      setCharCount(0);
    }, 500);
    return () => clearTimeout(advance);
  }, [visibleCount, charCount]);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#181B36] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34D399] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34D399]" />
        </span>
        <span className={`${mono.className} text-xs text-[#8892B0]`}>agent · online</span>
      </div>
      <div className="flex min-h-[220px] flex-col justify-end gap-2 p-4">
        {TRANSCRIPT.slice(0, visibleCount + 1).map((msg, i) => {
          const isCurrent = i === visibleCount;
          const text = isCurrent ? msg.text.slice(0, charCount) : msg.text;
          return (
            <div key={i} className={msg.role === "user" ? "self-end" : "self-start"}>
              <p
                className={`${body.className} max-w-[220px] rounded-xl px-3 py-2 text-[13px] leading-snug ${
                  msg.role === "user" ? "bg-[#E8A33D] text-[#12142B]" : "bg-white/10 text-[#F4F2EC]"
                }`}
              >
                {text}
                {isCurrent && charCount < msg.text.length && <span className="animate-pulse">▍</span>}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Reveals children once as they scroll into view. Compositor-friendly
// (transform/opacity only), IntersectionObserver-based (no scroll
// listeners), and skips straight to visible under prefers-reduced-motion.
function Reveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:!delay-0 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0 motion-reduce:translate-y-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

const ICONS = {
  answers: (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v6A2.5 2.5 0 0 1 14.5 14H9l-3.5 3v-3H5.5A2.5 2.5 0 0 1 3 11.5v-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
  books: (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8h14M7 4.5V3M13 4.5V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  remembers: (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6M16.5 3v3.5H13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  handsOff: (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 8.5v4M10 6.75v.02" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

const STEPS = [
  {
    n: "01",
    title: "Upload what you already have",
    body: "Price lists, hours, insurance info, FAQs — as a PDF or text file. No formatting required.",
  },
  {
    n: "02",
    title: "The agent learns it",
    body: "Your documents are broken down and indexed, so the agent answers from your actual policies — not guesses.",
  },
  {
    n: "03",
    title: "Drop one line on your site",
    body: "A single script tag. It works on any website, any platform, no developer needed on their end.",
  },
];

const CAPABILITIES = [
  { icon: "answers" as const, label: "answers", body: "Pricing, hours, policies, insurance — pulled from your own documents." },
  { icon: "books" as const, label: "books", body: "Collects name, email, and preferred time when a visitor wants to schedule." },
  { icon: "remembers" as const, label: "remembers", body: "Keeps context through a conversation — no repeating yourself." },
  { icon: "handsOff" as const, label: "hands off", body: "Says so plainly when it doesn't know something, instead of guessing." },
];

const USE_CASES = [
  {
    name: "Dental & medical",
    detail: "Insurance questions, appointment requests, after-hours coverage.",
    imageSeed: "frontdesk-dental-office-9",
  },
  { name: "Salons & spas", detail: "Service menus, pricing, booking interest capture." },
  { name: "Home services", detail: "Quote requests, service areas, scheduling callbacks." },
];

export default function LandingPage() {
  return (
    <div className={`${display.variable} ${body.variable} ${mono.variable} bg-[#12142B] text-[#F4F2EC]`}>
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className={`${display.className} text-lg font-bold`}>frontdesk<span className="text-[#E8A33D]">.ai</span></span>
        <div className="flex items-center gap-4">
          <Link href="/login" className={`${body.className} text-sm text-[#8892B0] hover:text-white`}>
            Log in
          </Link>
          <Link
            href="/signup"
            className={`${body.className} rounded-full bg-[#E8A33D] px-4 py-2 text-sm font-medium text-[#12142B] hover:opacity-90`}
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span className={`${mono.className} text-xs uppercase tracking-widest text-[#E8A33D]`}>
            AI front desk
          </span>
          <h1 className={`${display.className} mt-4 text-4xl font-bold leading-tight md:text-5xl`}>
            Someone&apos;s always at the desk.
            <br />
            Even at 2am.
          </h1>
          <p className={`${body.className} mt-5 max-w-md text-[15px] text-[#8892B0]`}>
            Give your business an AI agent that answers customer questions from your own
            documents, captures leads while you sleep, and lives on your site as one
            line of code.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/signup"
              className={`${body.className} rounded-full bg-[#E8A33D] px-6 py-3 text-sm font-medium text-[#12142B] hover:opacity-90`}
            >
              Get started free
            </Link>
            <a
              href="#how-it-works"
              className={`${body.className} rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-[#F4F2EC] hover:bg-white/5`}
            >
              See how it works
            </a>
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          <AnimatedTranscript />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-[#F4F2EC] py-20 text-[#12142B]">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2 className={`${display.className} text-2xl font-bold md:text-3xl`}>How it works</h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delayMs={i * 100}>
                <span className={`${mono.className} text-sm text-[#E8A33D]`}>{step.n}</span>
                <h3 className={`${display.className} mt-2 text-lg font-bold`}>{step.title}</h3>
                <p className={`${body.className} mt-2 text-sm text-[#5B5F73]`}>{step.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className={`${display.className} text-2xl font-bold md:text-3xl`}>What it handles</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 md:grid-cols-2">
          {CAPABILITIES.map((cap) => (
            <div key={cap.label} className="bg-[#12142B] p-6">
              <div className="flex items-center gap-2 text-[#E8A33D]">
                {ICONS[cap.icon]}
                <span className={`${mono.className} text-xs uppercase tracking-widest`}>{cap.label}</span>
              </div>
              <p className={`${body.className} mt-2 text-sm text-[#8892B0]`}>{cap.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section className="bg-[#F4F2EC] py-20 text-[#12142B]">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2 className={`${display.className} text-2xl font-bold md:text-3xl`}>
              Built for businesses that answer the same questions all day
            </h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Reveal className="lg:col-span-2">
              <div className="flex h-full flex-col overflow-hidden rounded-xl border border-black/10 sm:flex-row">
                <div className="relative h-48 w-full shrink-0 sm:h-auto sm:w-2/5">
                  <Image
                    src={`https://picsum.photos/seed/${USE_CASES[0].imageSeed}/500/500`}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 40vw, 100vw"
                    className="object-cover [filter:grayscale(1)_sepia(0.15)] mix-blend-luminosity"
                  />
                  <div className="absolute inset-0 bg-[#12142B]/35" />
                </div>
                <div className="flex flex-col justify-center p-6">
                  <h3 className={`${display.className} text-lg font-bold`}>{USE_CASES[0].name}</h3>
                  <p className={`${body.className} mt-2 text-sm text-[#5B5F73]`}>{USE_CASES[0].detail}</p>
                </div>
              </div>
            </Reveal>
            <div className="flex flex-col gap-6">
              {USE_CASES.slice(1).map((uc, i) => (
                <Reveal key={uc.name} delayMs={(i + 1) * 100} className="flex-1">
                  <div className="flex h-full flex-col justify-center rounded-xl border border-black/10 p-6">
                    <h3 className={`${display.className} font-bold`}>{uc.name}</h3>
                    <p className={`${body.className} mt-2 text-sm text-[#5B5F73]`}>{uc.detail}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className={`${display.className} text-2xl font-bold md:text-3xl`}>Simple pricing</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col rounded-xl border border-white/10 p-8">
            <h3 className={`${display.className} text-lg font-bold`}>Starter</h3>
            <p className={`${display.className} mt-2 text-3xl font-bold`}>Free</p>
            <p className={`${body.className} mt-2 text-sm text-[#8892B0]`}>
              1 agent, 1 document, up to 100 conversations/month.
            </p>
            <Link
              href="/signup"
              className={`${body.className} mt-6 rounded-full border border-white/15 px-5 py-2.5 text-center text-sm font-medium text-[#F4F2EC] hover:bg-white/5`}
            >
              Get started
            </Link>
          </div>
          <div className="flex flex-col rounded-xl border border-[#E8A33D] p-8">
            <h3 className={`${display.className} text-lg font-bold`}>Growth</h3>
            <p className={`${display.className} mt-2 text-3xl font-bold`}>
              $29<span className="text-sm font-normal text-[#8892B0]">/mo</span>
            </p>
            <p className={`${body.className} mt-2 text-sm text-[#8892B0]`}>
              Unlimited agents and documents, unlimited conversations.
            </p>
            <Link
              href="/signup"
              className={`${body.className} mt-6 rounded-full bg-[#E8A33D] px-5 py-2.5 text-center text-sm font-medium text-[#12142B] hover:opacity-90`}
            >
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-white/10 px-6 py-20 text-center">
        <Reveal className="flex flex-col items-center">
          <h2 className={`${display.className} text-2xl font-bold md:text-3xl`}>
            Stop answering the same five questions.
          </h2>
          <Link
            href="/signup"
            className={`${body.className} mt-6 inline-block rounded-full bg-[#E8A33D] px-6 py-3 text-sm font-medium text-[#12142B] hover:opacity-90`}
          >
            Get started free
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center">
        <p className={`${mono.className} text-xs text-[#8892B0]`}>frontdesk.ai — a portfolio project</p>
      </footer>
    </div>
  );
}
