import Link from "next/link";
import {
  ArrowRight,
  ChatCircleDots,
  Question,
  ShieldCheck,
  UserFocus,
} from "@phosphor-icons/react/dist/ssr";
import HeroPanel from "@/components/marketing/HeroPanel";
import { Reveal, Stagger, StaggerItem } from "@/components/marketing/Motion";
import CopyButton from "@/components/CopyButton";
import { BrandLink } from "@/components/Brand";

// Wired through so the hero can talk to the real demo agent when one is
// configured, and degrade to the scripted loop when it is not.
const DEMO_AGENT_ID = process.env.NEXT_PUBLIC_DEMO_AGENT_ID;

const EMBED_SNIPPET = `<script src="https://frontdesk.ai/widget.js"
        data-agent-id="YOUR_AGENT_ID"></script>`;

// One label per intent, used identically in the nav, the hero and the
// closing section. Three phrasings of "sign up" reads as three offers.
const CTA_SIGNUP = "Get started free";
const CTA_DEMO = "Try the live demo";

const STACK = [
  { name: "Next.js", slug: "nextdotjs" },
  { name: "FastAPI", slug: "fastapi" },
  { name: "PostgreSQL", slug: "postgresql" },
  { name: "Supabase", slug: "supabase" },
  { name: "Google Gemini", slug: "googlegemini" },
  { name: "Vercel", slug: "vercel" },
];

const STEPS = [
  {
    n: "01",
    title: "Upload what you already have",
    body: "Price lists, hours, insurance details, FAQs. A PDF or a text file. No formatting, no tagging, no rewriting it into a script.",
  },
  {
    n: "02",
    title: "It reads and indexes them",
    body: "Each document is split into passages and embedded, so a question retrieves the passages that answer it before a word is generated.",
  },
  {
    n: "03",
    title: "Paste one line on your site",
    body: "A single script tag. It works on Squarespace, WordPress or a plain static page. Nobody needs to touch a framework.",
  },
];

const USE_CASES = [
  {
    name: "Dental and medical",
    detail: "Insurance questions, appointment requests, after-hours coverage.",
    asked: "Do you take Delta Dental?",
  },
  {
    name: "Salons and spas",
    detail: "Service menus, pricing, and booking interest captured overnight.",
    asked: "How much is a balayage?",
  },
  {
    name: "Home services",
    detail: "Quote requests, service areas, and callbacks while you are on a job.",
    asked: "Do you cover the east side?",
  },
];

const INTERNALS = [
  {
    title: "Retrieval, not recall",
    body: "Documents are chunked, embedded, and stored in Postgres with pgvector. Every question runs a similarity search first, so the model answers from retrieved passages instead of from memory.",
  },
  {
    title: "Streamed token by token",
    body: "Replies arrive over Server-Sent Events as they are generated. Failures stream too, so an exhausted API quota shows up as a readable message rather than a socket that quietly dies.",
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

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav: single line, 64px tall. */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-void/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[78rem] items-center justify-between px-5 sm:px-8">
          <BrandLink />
          <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
            <a href="#how-it-works" className="focus-ring rounded text-sm text-mist transition hover:text-cream">
              How it works
            </a>
            <a href="#under-the-hood" className="focus-ring rounded text-sm text-mist transition hover:text-cream">
              Under the hood
            </a>
            <Link href="/demo" className="focus-ring rounded text-sm text-mist transition hover:text-cream">
              Demo
            </Link>
          </nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link
              href="/login"
              className="focus-ring rounded-full px-3 py-1.5 text-sm text-mist transition hover:text-cream"
            >
              Log in
            </Link>
            <Link href="/signup" className="btn btn-primary px-4 py-2 text-sm">
              {CTA_SIGNUP}
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================= 1. Hero (split) === */}
      <section className="mx-auto grid w-full max-w-[78rem] grid-cols-1 items-center gap-12 px-5 pt-16 pb-20 sm:px-8 lg:grid-cols-[1fr_26rem] lg:gap-16 lg:pt-24 lg:pb-28">
        <div>
          <div className="hero-in">
            {/* Two lines at desktop. The scale is deliberately restrained:
                the accent colour carries the emphasis, not raw size. */}
            <h1 className="font-display text-[2.25rem] leading-[1.06] font-extrabold tracking-[-0.03em] text-cream sm:text-[2.75rem] lg:text-[3.25rem]">
              Someone&apos;s always at the desk.
              <br />
              <span className="text-amber">Even at 2am.</span>
            </h1>
          </div>

          <div className="hero-in-2">
            <p className="mt-7 max-w-[32rem] text-[1.0625rem] leading-relaxed text-mist">
              An AI front desk trained on your hours, pricing and policies. It answers, books, and
              captures the lead.
            </p>
          </div>

          <div className="hero-in-3 mt-9 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn btn-primary px-6 py-3 text-[15px]">
              {CTA_SIGNUP}
              <ArrowRight weight="bold" className="h-4 w-4" />
            </Link>
            <Link href="/demo" className="btn btn-ghost px-6 py-3 text-[15px]">
              {CTA_DEMO}
            </Link>
          </div>
        </div>

        <div className="hero-in-4 flex justify-center lg:justify-end">
          <HeroPanel demoAgentId={DEMO_AGENT_ID} />
        </div>
      </section>

      {/* =================================== 2. Stack strip (logo wall) == */}
      <section className="border-y border-line bg-navy">
        <div className="mx-auto flex max-w-[78rem] flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:gap-12">
          <p className="shrink-0 text-[13px] text-dusk">Built with</p>
          <Reveal className="flex flex-wrap items-center gap-x-10 gap-y-6">
            {STACK.map((tech) => (
              // Real brand marks rather than styled text wordmarks, served as
              // single-colour SVG so they sit correctly on the dark ground.
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={tech.slug}
                src={`https://cdn.simpleicons.org/${tech.slug}/6b7499`}
                alt={tech.name}
                width={24}
                height={24}
                loading="lazy"
                className="h-6 w-auto opacity-80 transition hover:opacity-100"
              />
            ))}
          </Reveal>
        </div>
      </section>

      {/* ================== 3. The install (full-bleed centred artifact) == */}
      <section className="mx-auto w-full max-w-[52rem] px-5 py-24 text-center sm:px-8">
        <Reveal>
          <h2 className="font-display text-3xl font-bold tracking-tight text-cream sm:text-[2.5rem]">
            This is the entire integration.
          </h2>
          <p className="mx-auto mt-4 max-w-[34rem] text-[15px] leading-relaxed text-mist">
            No SDK, no npm install, no framework opinion. Paste it before the closing body tag and
            the widget is live on the site you already have.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-10">
          <div className="card overflow-hidden text-left">
            <div className="flex items-center gap-2 border-b border-line bg-well/50 px-4 py-2.5">
              <span className="font-mono text-[11px] text-dusk">index.html</span>
              <CopyButton value={EMBED_SNIPPET} className="ml-auto" />
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed sm:text-[13.5px]">
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
      </section>

      {/* ======================= 4. How it works (staircase progression) == */}
      <section id="how-it-works" className="scroll-mt-16 border-y border-line bg-navy">
        <div className="mx-auto max-w-[78rem] px-5 py-28 sm:px-8">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 font-display text-3xl leading-tight font-bold tracking-tight text-cream sm:text-[2.5rem]">
              Three steps, and none of them is writing a chatbot script.
            </h2>
          </Reveal>

          {/* Each step sits further right than the last, so the section reads
              as a path rather than three interchangeable columns. */}
          <Stagger className="mt-16 flex flex-col gap-14">
            {STEPS.map((step, i) => (
              <StaggerItem key={step.n}>
                <div
                  style={{ ["--indent" as string]: `${i * 7}rem` }}
                  className="max-w-2xl lg:pl-[var(--indent)]"
                >
                  <div className="flex items-baseline gap-5">
                    <span
                      aria-hidden="true"
                      className="font-mono text-[13px] font-medium tabular-nums text-amber"
                    >
                      {step.n}
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
                        {step.title}
                      </h3>
                      <p className="mt-3 text-[15px] leading-relaxed text-mist">{step.body}</p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============================= 5. What it does (asymmetric bento) = */}
      <section className="mx-auto w-full max-w-[78rem] px-5 py-28 sm:px-8">
        <Reveal>
          <h2 className="max-w-2xl font-display text-3xl leading-tight font-bold tracking-tight text-cream sm:text-[2.5rem]">
            What it actually does on your site
          </h2>
        </Reveal>

        <Stagger className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-4 md:grid-rows-2">
          {/* Large cell, carrying the one photograph in this section. */}
          <StaggerItem className="md:col-span-2 md:row-span-2">
            <article className="card relative flex h-full flex-col overflow-hidden">
              {/* A brand-tinted wash gives this cell visual weight without
                  pretending a stock photograph is a picture of the product. */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-amber/[0.14] to-transparent"
              />
              <div className="relative flex flex-1 flex-col justify-end p-7">
                <span
                  aria-hidden="true"
                  className="grid h-11 w-11 place-items-center rounded-xl border border-amber/25 bg-amber/10 text-amber"
                >
                  <ChatCircleDots weight="duotone" className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold tracking-tight text-cream">
                  Answers from your documents
                </h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-mist">
                  Pricing, hours, policies, which insurance you take. Drawn from the files you
                  uploaded, never invented.
                </p>
              </div>
            </article>
          </StaggerItem>

          {/* Tinted cell: the outcome the product is actually sold on. */}
          <StaggerItem className="md:col-span-2">
            <article className="card h-full border-amber/25 bg-amber/[0.07] p-6">
              <span
                aria-hidden="true"
                className="grid h-11 w-11 place-items-center rounded-xl border border-amber/30 bg-amber/15 text-amber"
              >
                <UserFocus weight="duotone" className="h-6 w-6" />
              </span>
              <h3 className="mt-5 font-display text-xl font-bold tracking-tight text-cream">
                Captures the lead
              </h3>
              <p className="mt-2.5 max-w-md text-[15px] leading-relaxed text-mist">
                When a visitor wants to book, it collects a name, an email and what they are after,
                then files it in your dashboard.
              </p>
            </article>
          </StaggerItem>

          <StaggerItem>
            <article className="card h-full p-6">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-well text-mist"
              >
                <Question weight="duotone" className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-bold tracking-tight text-cream">
                Holds the thread
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-mist">
                Follow-up questions keep their context.
              </p>
            </article>
          </StaggerItem>

          <StaggerItem>
            <article className="card h-full p-6">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-well text-mist"
              >
                <ShieldCheck weight="duotone" className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-bold tracking-tight text-cream">
                Says when it cannot answer
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-mist">
                Then offers a hand-off instead of guessing.
              </p>
            </article>
          </StaggerItem>
        </Stagger>
      </section>

      {/* ================================ 6. Who it is for (scroll rail) == */}
      <section className="border-y border-line bg-navy py-28">
        <div className="mx-auto max-w-[78rem] px-5 sm:px-8">
          <Reveal>
            <h2 className="max-w-2xl font-display text-3xl leading-tight font-bold tracking-tight text-cream sm:text-[2.5rem]">
              Built for businesses that answer the same five questions all day
            </h2>
          </Reveal>
        </div>

        {/* Full-bleed rail so the cards run past the container edge and read
            as a set you scroll, not a row that happens to be three wide. */}
        <Reveal className="mt-14">
          <div className="rail flex gap-5 overflow-x-auto px-5 pb-4 sm:px-8 lg:px-[max(2rem,calc((100vw-78rem)/2))]">
            {USE_CASES.map((uc) => (
              <article
                key={uc.name}
                className="card flex w-[17rem] shrink-0 flex-col p-6 sm:w-[21rem]"
              >
                {/* The question a real visitor types is more useful here than
                    a stock photograph of a room. */}
                <p className="font-mono text-[13px] leading-relaxed text-amber-soft">
                  &ldquo;{uc.asked}&rdquo;
                </p>
                <h3 className="mt-6 font-display text-lg font-bold tracking-tight text-cream">
                  {uc.name}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-mist">{uc.detail}</p>
              </article>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ========================= 7. Under the hood (editorial list) ===== */}
      <section
        id="under-the-hood"
        className="mx-auto w-full max-w-[78rem] scroll-mt-16 px-5 py-28 sm:px-8"
      >
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Under the hood</p>
          <h2 className="mt-3 font-display text-3xl leading-tight font-bold tracking-tight text-cream sm:text-[2.5rem]">
            The part a reviewer would want to poke at
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-mist">
            A Next.js dashboard and embeddable widget in front of a FastAPI service that owns
            retrieval, generation, and every authorization decision.
          </p>
        </Reveal>

        {/* Spacing and one hairline per row, not four boxes. Elevation would
            imply these are separate things you can act on. */}
        <Stagger className="mt-14 divide-y divide-line border-t border-line">
          {INTERNALS.map((item, i) => (
            <StaggerItem key={item.title}>
              <div className="grid grid-cols-1 gap-3 py-8 md:grid-cols-[3rem_18rem_1fr] md:gap-8">
                <span aria-hidden="true" className="font-mono text-[13px] tabular-nums text-dusk">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-lg font-bold tracking-tight text-cream">
                  {item.title}
                </h3>
                <p className="max-w-2xl text-[15px] leading-relaxed text-mist">{item.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ================================== 8. Closing (centred manifesto) = */}
      <section className="border-t border-line bg-navy">
        <div className="mx-auto max-w-[44rem] px-5 py-32 text-center sm:px-8">
          <Reveal>
            <h2 className="font-display text-4xl leading-[1.05] font-extrabold tracking-[-0.035em] text-cream sm:text-[3.5rem]">
              Stop answering the same five questions.
            </h2>
            <p className="mx-auto mt-6 max-w-md text-[16px] leading-relaxed text-mist">
              Upload one document, get an agent, paste one line. It can be running before your next
              customer emails.
            </p>
            <div className="mt-10 flex justify-center">
              <Link href="/signup" className="btn btn-primary px-8 py-3.5 text-[15px]">
                {CTA_SIGNUP}
                <ArrowRight weight="bold" className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[78rem] flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <BrandLink />
          <p className="font-mono text-[11px] text-dusk">frontdesk.ai, a portfolio project</p>
        </div>
      </footer>
    </div>
  );
}
