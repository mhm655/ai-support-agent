import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import HeroPanel from "@/components/marketing/HeroPanel";
import TiltPanel from "@/components/marketing/TiltPanel";
import RetrievalDiagram from "@/components/marketing/RetrievalDiagram";
import { Reveal, Stagger, StaggerItem } from "@/components/marketing/Motion";
import CopyButton from "@/components/CopyButton";
import { BrandLink } from "@/components/Brand";

const DEMO_AGENT_ID = process.env.NEXT_PUBLIC_DEMO_AGENT_ID;

const EMBED_SNIPPET = `<script src="https://frontdesk.ai/widget.js"
        data-agent-id="YOUR_AGENT_ID"></script>`;

// One label per intent, used identically everywhere it appears.
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

const CAPABILITIES = [
  {
    title: "Answers from your documents",
    body: "Pricing, hours, policies, which insurance you take. Drawn from the files you uploaded, never invented.",
  },
  {
    title: "Captures the lead",
    body: "When a visitor wants to book, it collects a name, an email and what they are after, then files it in your dashboard.",
  },
  {
    title: "Holds the thread",
    body: "Follow-up questions keep their context. Nobody has to repeat which appointment they were asking about.",
  },
  {
    title: "Says when it cannot answer",
    body: "If the answer is not in your documents it says so and offers a hand-off, instead of guessing.",
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
    body: "Replies arrive over Server-Sent Events as they are generated. Failures stream too, so an exhausted API quota surfaces as a readable message rather than a socket that quietly dies.",
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
      {/* Nav: one line, 64px, a hairline rule rather than a shadow. */}
      <header className="sticky top-0 z-40 border-b border-edge bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[82rem] items-center justify-between px-5 sm:px-8">
          <BrandLink />
          <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
            <a href="#how" className="focus-ring rounded text-[14px] text-ink-muted transition hover:text-ink">
              How it works
            </a>
            <a
              href="#retrieval"
              className="focus-ring rounded text-[14px] text-ink-muted transition hover:text-ink"
            >
              Retrieval
            </a>
            <a
              href="#internals"
              className="focus-ring rounded text-[14px] text-ink-muted transition hover:text-ink"
            >
              Under the hood
            </a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link
              href="/login"
              className="focus-ring rounded-full px-3 py-1.5 text-[14px] text-ink-muted transition hover:text-ink"
            >
              Log in
            </Link>
            <Link href="/signup" className="btn btn-primary px-4 py-2 text-[14px]">
              {CTA_SIGNUP}
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================== 1. Hero (split) === */}
      <section>
        <div className="mx-auto grid max-w-[82rem] grid-cols-1 items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.15fr_25rem] lg:gap-20 lg:py-24">
          <div>
            <div className="hero-in">
              {/* The whole voice of the page is in this block: heavy Archivo,
                  near-zero leading, tight negative tracking. */}
              <h1 className="display-xl text-[3rem] sm:text-[4.25rem] lg:text-[5.25rem]">
                Someone&apos;s always
                <br />
                at the desk.
                <br />
                <span className="text-volt">Even at 2am.</span>
              </h1>
            </div>

            <div className="hero-in-2">
              <p className="mt-8 max-w-[34rem] text-[17px] leading-relaxed text-ink-muted">
                An AI front desk trained on your hours, pricing and policies. It answers, books, and
                captures the lead.
              </p>
            </div>

            <div className="hero-in-3 mt-10 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn btn-volt px-6 py-3">
                {CTA_SIGNUP}
                <ArrowRight weight="bold" className="h-4 w-4" />
              </Link>
              <Link href="/demo" className="btn btn-ghost px-6 py-3">
                {CTA_DEMO}
              </Link>
            </div>
          </div>

          <TiltPanel className="hero-in-4 flex justify-center lg:justify-end">
            <HeroPanel demoAgentId={DEMO_AGENT_ID} />
          </TiltPanel>
        </div>
      </section>

      {/* ==================================== 2. Stack strip (logo wall) == */}
      <section>
        <div className="mx-auto flex max-w-[82rem] flex-col gap-6 px-5 py-7 sm:px-8 md:flex-row md:items-center md:gap-14">
          <p className="shrink-0 text-[13px] text-ink-faint">Built with</p>
          <Reveal className="flex flex-wrap items-center gap-x-11 gap-y-6">
            {STACK.map((tech) => (
              // Real brand marks rather than styled text wordmarks.
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={tech.slug}
                src={`https://cdn.simpleicons.org/${tech.slug}/8a8a80`}
                alt={tech.name}
                width={22}
                height={22}
                loading="lazy"
                className="h-[22px] w-auto opacity-90 transition hover:opacity-100"
              />
            ))}
          </Reveal>
        </div>
      </section>

      {/* =================== 3. Retrieval, drawn (the signature moment) === */}
      <section id="retrieval" className="scroll-mt-16">
        <div className="mx-auto max-w-[82rem] px-5 pt-24 sm:px-8">
          <Reveal className="max-w-3xl">
            <p className="label-mono text-volt">The part that decides whether it is true</p>
            <h2 className="display mt-5 text-[2.25rem] sm:text-[3rem]">
              It does not know your business.
              <br />
              It looks your business up.
            </h2>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-muted">
              Before a single word is generated, the question is embedded and matched against the
              passages of your own documents. The model only ever answers from what came back.
            </p>
          </Reveal>
        </div>

        <Reveal className="mt-16 border-t border-edge">
          <RetrievalDiagram />
        </Reveal>
      </section>

      {/* ==================== 4. The install (centred code artifact) ====== */}
      <section className="bg-paper-sunk">
        <div className="mx-auto max-w-[52rem] px-5 py-24 text-center sm:px-8">
          <Reveal>
            <h2 className="display text-[2rem] sm:text-[2.5rem]">This is the entire integration.</h2>
            <p className="mx-auto mt-5 max-w-[34rem] text-[15px] leading-relaxed text-ink-muted">
              No SDK, no npm install, no framework opinion. Paste it before the closing body tag and
              the widget is live on the site you already have.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-10">
            <div
              className="panel-dark overflow-hidden text-left"
              style={{ boxShadow: "var(--shadow-4)" }}
            >
              <div className="flex items-center gap-2 border-b border-edge-dark px-4 py-2.5">
                <span className="font-mono text-[11px] text-bone-faint">index.html</span>
                <CopyButton value={EMBED_SNIPPET} tone="dark" className="ml-auto" />
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed sm:text-[13.5px]">
                <code>
                  <span className="text-bone-faint">&lt;</span>
                  <span className="text-volt">script</span>{" "}
                  <span className="text-bone-muted">src</span>
                  <span className="text-bone-faint">=</span>
                  <span className="text-bone">&quot;https://frontdesk.ai/widget.js&quot;</span>
                  {"\n        "}
                  <span className="text-bone-muted">data-agent-id</span>
                  <span className="text-bone-faint">=</span>
                  <span className="text-bone">&quot;YOUR_AGENT_ID&quot;</span>
                  <span className="text-bone-faint">&gt;&lt;/</span>
                  <span className="text-volt">script</span>
                  <span className="text-bone-faint">&gt;</span>
                </code>
              </pre>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ======================= 5. How it works (staircase progression) == */}
      <section id="how" className="scroll-mt-16">
        <div className="mx-auto max-w-[82rem] px-5 py-24 sm:px-8">
          <Reveal className="max-w-2xl">
            <h2 className="display text-[2rem] sm:text-[2.75rem]">
              Three steps, and none of them is writing a chatbot script.
            </h2>
          </Reveal>

          {/* Each step sits further right than the last, so the section reads
              as a path rather than three interchangeable columns. */}
          <Stagger className="mt-16 flex flex-col gap-12">
            {STEPS.map((step, i) => (
              <StaggerItem key={step.n}>
                <div
                  style={{ ["--indent" as string]: `${i * 8}rem` }}
                  className="max-w-2xl border-t border-edge pt-6 lg:ml-[var(--indent)]"
                >
                  <div className="flex items-baseline gap-6">
                    <span aria-hidden="true" className="font-mono text-[12px] tabular-nums text-volt">
                      {step.n}
                    </span>
                    <div>
                      <h3 className="display text-[1.35rem] sm:text-[1.6rem]">{step.title}</h3>
                      <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{step.body}</p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============ 6. What it does (glass panels on the colour field) == */}
      {/* The page's one saturated ground. Translucent panels float on it and
          pick up its light through their edges, which is the whole reason
          for using glass rather than a tinted box. */}
      <section className="field-bg relative overflow-hidden text-white">
        <div className="relative mx-auto max-w-[82rem] px-5 py-28 sm:px-8">
          <Reveal>
            <h2 className="display max-w-2xl text-[2rem] sm:text-[2.75rem]">
              What it actually does on your site
            </h2>
          </Reveal>

          <Stagger className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((cap, i) => (
              <StaggerItem key={cap.title} className="h-full">
                <div className="glass h-full p-6">
                  <span aria-hidden="true" className="font-mono text-[11px] tabular-nums text-white/55">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 text-[17px] leading-snug font-semibold text-white">
                    {cap.title}
                  </h3>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/72">{cap.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ======================= 7. The dashboard (product showcase) ====== */}
      {/* A real screenshot of the running product, not a rendering of one. */}
      <section className="bg-paper-sunk">
        <div className="mx-auto max-w-[82rem] px-5 pt-24 sm:px-8">
          <Reveal className="max-w-2xl">
            <h2 className="display text-[2rem] sm:text-[2.75rem]">
              Every conversation that turns into a lead lands here
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-ink-muted">
              Name, contact details, and what the visitor actually wanted, captured while you were
              closed. Searchable, and one click from replying.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="mx-auto mt-14 max-w-[58rem] px-5 sm:px-8">
            {/* Cropped and faded at the bottom, so the panel reads as part of
                a longer list rather than a screenshot that ends. */}
            <div
              className="relative max-h-[24rem] overflow-hidden rounded-t-[4px] border border-b-0 border-edge-dark"
              style={{ boxShadow: "var(--shadow-4)" }}
            >
              <Image
                src="/images/product-leads.png"
                width={1408}
                height={1460}
                alt="The dashboard's Leads tab, listing captured leads with each visitor's name, email or phone, and a note of what they asked about."
                className="w-full"
                sizes="(min-width: 928px) 58rem, 100vw"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-paper-sunk to-transparent"
              />
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================================= 8. Who it is for (scroll rail) = */}
      <section className="py-24">
        <div className="mx-auto max-w-[82rem] px-5 sm:px-8">
          <Reveal>
            <h2 className="display max-w-2xl text-[2rem] sm:text-[2.75rem]">
              Built for businesses that answer the same five questions all day
            </h2>
          </Reveal>
        </div>

        <Reveal className="mt-14">
          <div className="rail flex gap-4 overflow-x-auto px-5 pb-4 sm:px-8 lg:px-[max(2rem,calc((100vw-82rem)/2))]">
            {USE_CASES.map((uc) => (
              <article
                key={uc.name}
                className="panel flex w-[17rem] shrink-0 flex-col p-6 sm:w-[21rem]"
              >
                {/* The question a real visitor types is more useful here than
                    a stock photograph of a room. */}
                <p className="font-mono text-[13px] leading-relaxed text-volt">
                  &ldquo;{uc.asked}&rdquo;
                </p>
                <h3 className="mt-8 text-[17px] font-semibold">{uc.name}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-muted">{uc.detail}</p>
              </article>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ========================== 9. Under the hood (editorial list) ==== */}
      <section id="internals" className="scroll-mt-16">
        <div className="mx-auto max-w-[82rem] px-5 py-24 sm:px-8">
          <Reveal className="max-w-2xl">
            <p className="label-mono text-ink-faint">Under the hood</p>
            <h2 className="display mt-5 text-[2rem] sm:text-[2.75rem]">
              The part a reviewer would want to poke at
            </h2>
          </Reveal>

          <Stagger className="mt-14 border-t border-edge">
            {INTERNALS.map((item, i) => (
              <StaggerItem key={item.title}>
                <div className="grid grid-cols-1 gap-3 border-b border-edge py-8 md:grid-cols-[3rem_17rem_1fr] md:gap-10">
                  <span aria-hidden="true" className="font-mono text-[12px] tabular-nums text-volt">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-[17px] font-semibold">{item.title}</h3>
                  <p className="max-w-2xl text-[15px] leading-relaxed text-ink-muted">{item.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ====================== 10. Closing (inverted manifesto slab) ===== */}
      {/* The one full theme flip on the page, used once as a deliberate
          close rather than as alternating decoration. */}
      <section className="bg-slab text-bone">
        <div className="mx-auto max-w-[52rem] px-5 py-32 text-center sm:px-8">
          <Reveal>
            <h2 className="display-xl text-[2.5rem] sm:text-[3.75rem]">
              Stop answering the same five questions.
            </h2>
            <p className="mx-auto mt-7 max-w-md text-[16px] leading-relaxed text-bone-muted">
              Upload one document, get an agent, paste one line. It can be running before your next
              customer emails.
            </p>
            <div className="mt-10 flex justify-center">
              <Link href="/signup" className="btn btn-volt px-8 py-3.5">
                {CTA_SIGNUP}
                <ArrowRight weight="bold" className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="bg-slab">
        <div className="mx-auto flex max-w-[82rem] flex-col items-center justify-between gap-4 border-t border-edge-dark px-5 py-8 sm:flex-row sm:px-8">
          <BrandLink invert />
          <p className="font-mono text-[11px] text-bone-faint">frontdesk.ai, a portfolio project</p>
        </div>
      </footer>
    </div>
  );
}
