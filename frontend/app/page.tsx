import Link from "next/link";
import Reveal from "@/components/Reveal";
import HeroTranscript from "@/components/HeroTranscript";
import CopyButton from "@/components/CopyButton";
import { BrandLink } from "@/components/Brand";
import {
  ArrowRightIcon,
  ChatIcon,
  ClockIcon,
  CodeIcon,
  ConversationIcon,
  DocumentIcon,
  ShieldIcon,
  SparkIcon,
  UserIcon,
} from "@/lib/icons";

const EMBED_SNIPPET = `<script src="https://frontdesk.ai/widget.js"
        data-agent-id="YOUR_AGENT_ID"></script>`;

const STEPS = [
  {
    n: "01",
    title: "Upload what you already have",
    body: "Price lists, hours, insurance info, FAQs — a PDF or a text file. No formatting, no tagging, no rewriting it into a bot script.",
  },
  {
    n: "02",
    title: "It reads and indexes them",
    body: "Each document is split into passages and embedded, so a question retrieves the passages that actually answer it before a single word is generated.",
  },
  {
    n: "03",
    title: "Paste one line on your site",
    body: "A single script tag. Works on Squarespace, WordPress, a static page — nobody needs to touch a framework.",
  },
];

const CAPABILITIES = [
  {
    icon: ChatIcon,
    title: "Answers from your documents",
    body: "Pricing, hours, policies, what insurance you take — drawn from the files you uploaded, not invented.",
  },
  {
    icon: UserIcon,
    title: "Captures the lead",
    body: "When a visitor wants to book, it collects a name, an email and what they are after, and files it in your dashboard.",
  },
  {
    icon: ConversationIcon,
    title: "Holds the thread",
    body: "Follow-up questions keep their context. Nobody has to repeat which appointment they were asking about.",
  },
  {
    icon: ShieldIcon,
    title: "Admits what it does not know",
    body: "If the answer is not in your documents, it says so and offers a hand-off, instead of confidently making something up.",
  },
];

const USE_CASES = [
  {
    icon: ShieldIcon,
    name: "Dental & medical",
    detail: "Insurance questions, appointment requests, after-hours coverage.",
    line: "“Do you take Delta Dental?”",
  },
  {
    icon: SparkIcon,
    name: "Salons & spas",
    detail: "Service menus, pricing, and booking interest captured overnight.",
    line: "“How much is a balayage?”",
  },
  {
    icon: ClockIcon,
    name: "Home services",
    detail: "Quote requests, service areas, and callbacks scheduled while you are on a job.",
    line: "“Do you cover the east side?”",
  },
];

const INTERNALS = [
  {
    title: "Retrieval, not recall",
    body: "Documents are chunked, embedded, and stored in Postgres with pgvector. Every question runs a similarity search first, so the model answers from retrieved passages instead of from memory.",
  },
  {
    title: "Streamed token by token",
    body: "Replies arrive over Server-Sent Events as they are generated. Failures stream too — an exhausted API quota shows up as a readable message, not a socket that quietly dies.",
  },
  {
    title: "Lead capture by function call",
    body: "The model decides when it has a name and a way to reach someone, then calls a tool to record it. No brittle regex scraping the transcript for an @ sign.",
  },
  {
    title: "Scoped at the API boundary",
    body: "Every dashboard query resolves a business ID from a verified JWT before it touches a row. The public chat endpoint is the one deliberately open surface.",
  },
];

const STACK = ["Next.js", "FastAPI", "Postgres + pgvector", "Supabase Auth", "Gemini", "SSE streaming"];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ---------------------------------------------------------------- Nav */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-void/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <BrandLink />
          <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
            <a href="#how-it-works" className="focus-ring rounded text-sm text-mist transition hover:text-cream">
              How it works
            </a>
            <a href="#under-the-hood" className="focus-ring rounded text-sm text-mist transition hover:text-cream">
              Under the hood
            </a>
            <Link href="/demo" className="focus-ring rounded text-sm text-mist transition hover:text-cream">
              Live demo
            </Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="focus-ring rounded-full px-3 py-1.5 text-sm text-mist transition hover:text-cream"
            >
              Log in
            </Link>
            <Link href="/signup" className="btn btn-primary px-4 py-2 text-sm">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="glow-amber pointer-events-none absolute inset-x-0 top-0 h-[520px]" />
        <div aria-hidden="true" className="grid-lines pointer-events-none absolute inset-0" />

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-5 pt-16 pb-20 sm:px-8 md:grid-cols-[1.05fr_0.95fr] md:pt-24 md:pb-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-3 py-1.5 text-[12px] text-mist backdrop-blur">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber" />
              Answers from your documents — not from guesswork
            </span>

            <h1 className="mt-6 font-display text-[42px] font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-6xl">
              <span className="text-gradient">Someone&apos;s always</span>
              <br />
              <span className="text-gradient">at the desk.</span>
              <br />
              <span className="text-amber">Even at 2am.</span>
            </h1>

            <p className="mt-6 max-w-[30rem] text-[17px] leading-relaxed text-mist">
              An AI front desk trained on your own hours, pricing and policies. It answers, it books,
              and it hands you the lead in the morning.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn btn-primary px-6 py-3 text-[15px]">
                Get started free
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link href="/demo" className="btn btn-ghost px-6 py-3 text-[15px]">
                Try the live demo
              </Link>
            </div>

            <p className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-dusk">
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5 text-amber" /> Live in about five minutes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CodeIcon className="h-3.5 w-3.5 text-amber" /> One script tag
              </span>
              <span className="inline-flex items-center gap-1.5">
                <DocumentIcon className="h-3.5 w-3.5 text-amber" /> PDF, .txt or .md
              </span>
            </p>
          </div>

          <div className="flex justify-center md:justify-end">
            <HeroTranscript />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Embed snippet */}
      <section className="relative border-y border-line bg-navy">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal>
            <p className="eyebrow">The whole install</p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-[28px]">
              This is the entire integration.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-mist">
              No SDK, no npm install, no framework opinion. Paste it before the closing{" "}
              <code className="rounded bg-well px-1.5 py-0.5 font-mono text-[13px] text-amber-soft">
                &lt;/body&gt;
              </code>{" "}
              tag and the widget is live on the site you already have.
            </p>
          </Reveal>

          <Reveal delayMs={120}>
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line bg-well/50 px-4 py-2.5">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald/60" />
                </span>
                <span className="font-mono text-[11px] text-dusk">index.html</span>
                <CopyButton value={EMBED_SNIPPET} className="ml-auto" />
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed sm:text-[13px]">
                <code>
                  <span className="text-dusk">&lt;</span>
                  <span className="text-amber">script</span>{" "}
                  <span className="text-emerald">src</span>
                  <span className="text-dusk">=</span>
                  <span className="text-cream">&quot;https://frontdesk.ai/widget.js&quot;</span>
                  {"\n        "}
                  <span className="text-emerald">data-agent-id</span>
                  <span className="text-dusk">=</span>
                  <span className="text-cream">&quot;YOUR_AGENT_ID&quot;</span>
                  <span className="text-dusk">&gt;&lt;/</span>
                  <span className="text-amber">script</span>
                  <span className="text-dusk">&gt;</span>
                </code>
              </pre>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------ How it works */}
      {/* Asymmetric on purpose: a sticky heading rail beside a vertical
          timeline, rather than the three-equal-columns feature row that every
          generated landing page reaches for. */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <p className="eyebrow">How it works</p>
              <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-[38px]">
                Three steps, and none of them is &ldquo;write a chatbot script&rdquo;.
              </h2>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-mist">
                You already wrote your policies down once. This reads them, instead of asking you to
                turn them into a decision tree.
              </p>
            </Reveal>
          </div>

          <ol className="relative">
            {/* The connecting rail. Stops short of the last marker so it reads
                as a path with an end rather than a stray border. */}
            <span
              aria-hidden="true"
              className="absolute top-4 bottom-24 left-[19px] w-px bg-gradient-to-b from-amber/50 via-line-bright to-transparent"
            />
            {/* Laid out as a flex row rather than an absolutely positioned
                marker: Reveal applies a transform, which makes it a
                containing block, so an `absolute` marker inside it would
                anchor to the wrapper instead of the list item. */}
            {STEPS.map((step, i) => (
              <li key={step.n} className="pb-12 last:pb-0">
                <Reveal delayMs={i * 90} className="flex gap-6">
                  <span
                    aria-hidden="true"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-card font-mono text-[13px] font-medium text-amber"
                  >
                    {step.n}
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold tracking-tight text-cream">{step.title}</h3>
                    <p className="mt-2.5 max-w-lg text-[15px] leading-relaxed text-mist">{step.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ----------------------------------------------------- Capabilities */}
      <section className="border-y border-line bg-navy">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <Reveal>
            <h2 className="max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight sm:text-[38px]">
              What it actually does on your site
            </h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CAPABILITIES.map((cap, i) => (
              <Reveal key={cap.title} delayMs={i * 70} className="h-full">
                <div className="card group h-full p-6 transition duration-200 hover:border-line-bright hover:bg-well/60">
                  <span
                    aria-hidden="true"
                    className="grid h-10 w-10 place-items-center rounded-xl border border-amber/25 bg-amber/10 text-amber transition group-hover:bg-amber/15"
                  >
                    <cap.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-cream">{cap.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-mist">{cap.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Use cases */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <Reveal>
          <p className="eyebrow">Who it is for</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight sm:text-[38px]">
            Built for businesses that answer the same five questions all day
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {USE_CASES.map((uc, i) => (
            <Reveal key={uc.name} delayMs={i * 80} className="h-full">
              <div className="card flex h-full flex-col p-6">
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-well text-amber"
                >
                  <uc.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-cream">{uc.name}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-mist">{uc.detail}</p>
                <p className="mt-5 border-t border-line pt-4 font-mono text-[12.5px] text-dusk">{uc.line}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- Under the hood */}
      {/* This replaced an invented pricing table. There is no billing in this
          project, so quoting a "$29/mo Growth tier" was fiction that the code
          immediately contradicts. What is here is true, and for the audience
          that actually reads a portfolio repo, more interesting. */}
      <section id="under-the-hood" className="scroll-mt-20 border-y border-line bg-navy">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <Reveal>
            <p className="eyebrow">Under the hood</p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight sm:text-[38px]">
              The part a reviewer would want to poke at
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mist">
              A Next.js dashboard and embeddable widget in front of a FastAPI service that owns
              retrieval, generation, and every authorization decision.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {INTERNALS.map((item, i) => (
              <div key={item.title} className="bg-card p-7">
                <Reveal delayMs={i * 60}>
                  <span className="font-mono text-[11px] text-dusk">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 font-display text-lg font-bold tracking-tight text-cream">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-mist">{item.body}</p>
                </Reveal>
              </div>
            ))}
          </div>

          <Reveal delayMs={120}>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-card px-5 py-4">
              <span className="font-mono text-[11px] uppercase tracking-widest text-dusk">Stack</span>
              {STACK.map((tech) => (
                <span key={tech} className="badge border border-line bg-well text-mist">
                  {tech}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- Final CTA */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="glow-amber pointer-events-none absolute inset-x-0 bottom-0 h-96 rotate-180"
        />
        <div className="relative mx-auto max-w-3xl px-5 py-28 text-center sm:px-8">
          <Reveal className="flex flex-col items-center">
            <h2 className="font-display text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-5xl">
              Stop answering the same five questions.
            </h2>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-mist">
              Upload one document, get an agent, paste one line. You can have it running before your
              next customer emails.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="btn btn-primary px-7 py-3.5 text-[15px]">
                Get started free
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link href="/demo" className="btn btn-ghost px-7 py-3.5 text-[15px]">
                Try the live demo
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <BrandLink />
          <p className="font-mono text-[11px] text-dusk">frontdesk.ai — a portfolio project</p>
        </div>
      </footer>
    </div>
  );
}
