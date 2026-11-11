import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import LiveDemo from "@/components/marketing/LiveDemo";
import { Reveal } from "@/components/marketing/Motion";
import CopyButton from "@/components/CopyButton";
import { BrandLink } from "@/components/Brand";

const DEMO_AGENT_ID = process.env.NEXT_PUBLIC_DEMO_AGENT_ID;

const EMBED_SNIPPET = `<script src="https://frontdesk.ai/widget.js"
        data-agent-id="YOUR_AGENT_ID"></script>`;

// One label per intent, used identically everywhere it appears. The demo
// has no button: it is live in the hero itself.
const CTA_SIGNUP = "Get started free";

// Each step is named by its verb, which is the label. Numbering them 01, 02,
// 03 said nothing the order of the list does not already say.
const STEPS = [
  {
    verb: "Upload",
    body: "Your price list, opening hours, policies and FAQs. A PDF or a text file, exactly as it is.",
  },
  {
    verb: "Ask",
    body: "Visitors ask in their own words, at any hour. Every answer comes from your files.",
  },
  {
    verb: "Paste",
    body: "One line of code on your website. It works on Squarespace, WordPress and anything else.",
  },
];

// The question a real visitor types, next to who asks it.
const WHO = [
  { who: "Dentists", asked: "Do you take Delta Dental?" },
  { who: "Salons", asked: "How much is a balayage?" },
  { who: "Contractors", asked: "Do you cover the east side?" },
];

const REPO_URL = "https://github.com/mhm655/ai-support-agent";

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
            <a href="#who" className="focus-ring rounded text-[14px] text-ink-muted transition hover:text-ink">
              Who it&apos;s for
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

      {/* ========================================= 1. Hero (poster) === */}
      {/*
        Type-led and asymmetric. The headline runs across the full width,
        its second line pushed right; under it, the pitch sits in a narrow
        left column and the real agent sits to the right. The demo panel is
        the only product imagery here, and it is the product, live.
      */}
      <section>
        <div className="mx-auto max-w-[82rem] px-5 pt-12 pb-20 sm:px-8 lg:pt-16 lg:pb-28">
          <h1 className="display-poster text-[clamp(3.75rem,10vw,9.5rem)] text-ink">
            <span className="poster-line">
              <span className="poster-in">Someone&apos;s always</span>
            </span>
            <span className="poster-line sm:pl-[14vw]">
              <span className="poster-in poster-in-2">at the desk.</span>
            </span>
          </h1>

          <div className="mt-12 grid grid-cols-1 gap-12 lg:mt-16 lg:grid-cols-12 lg:gap-8">
            <div className="hero-in-2 lg:col-span-4">
              <p className="max-w-[26rem] text-[19px] leading-[1.45] text-ink-muted">
                <span className="font-semibold text-ink">Even at 2am.</span> An AI front desk that
                answers from your own documents and captures the lead.
              </p>
              <div className="mt-8">
                <Link href="/signup" className="btn btn-volt px-6 py-3">
                  {CTA_SIGNUP}
                  <ArrowRight weight="bold" className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {DEMO_AGENT_ID && (
              <div className="hero-in-3 lg:col-span-6 lg:col-start-7">
                <LiveDemo agentId={DEMO_AGENT_ID} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================================= 2. How it works (verbs) === */}
      {/* Giant condensed verbs as the labels, a sentence each beside them.
          The install snippet lives in its own step instead of a section. */}
      <section id="how" className="scroll-mt-16">
        <div className="mx-auto max-w-[82rem] px-5 py-24 sm:px-8 lg:py-32">
          <Reveal>
            <h2 className="display text-[2rem] sm:text-[2.75rem]">How it works</h2>
          </Reveal>

          <div className="mt-12 divide-y divide-edge border-t border-edge">
            {STEPS.map((step) => (
              <Reveal key={step.verb}>
                <div className="grid grid-cols-1 gap-4 py-10 lg:grid-cols-12 lg:items-end lg:gap-8 lg:py-14">
                  <h3 className="display-poster text-[clamp(3.25rem,8vw,7.5rem)] lg:col-span-6">
                    {step.verb}
                  </h3>
                  <div className="lg:col-span-5 lg:col-start-8">
                    <p className="text-[18px] leading-[1.5] text-ink-muted">{step.body}</p>
                    {step.verb === "Paste" && (
                      <div className="mt-6 overflow-hidden rounded-[var(--radius-control)] border border-edge bg-paper-sunk">
                        <div className="flex items-center border-b border-edge px-4 py-2">
                          <span className="font-mono text-[11px] text-ink-faint">index.html</span>
                          <CopyButton value={EMBED_SNIPPET} className="ml-auto" />
                        </div>
                        <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-ink">
                          <code>{EMBED_SNIPPET}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================= 3. Two promises (staggered pair) === */}
      {/* What it will and will not do, as two statements set on a diagonal
          rather than a row of feature cards. This replaces the animated
          retrieval diagram, which showed invented documents and scores. */}
      <section>
        <div className="mx-auto grid max-w-[82rem] grid-cols-1 gap-20 px-5 pb-24 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:pb-32">
          <Reveal className="lg:col-span-6">
            <h2 className="display text-[2.25rem] leading-[1.02] sm:text-[3.25rem]">
              It only says what your documents say.
            </h2>
            <p className="mt-6 max-w-[30rem] text-[17px] leading-[1.55] text-ink-muted">
              No invented prices and no guessed opening hours. If the answer isn&apos;t in your
              files, it tells the visitor and offers to have someone get back to them.
            </p>
          </Reveal>

          <Reveal className="lg:col-span-6 lg:col-start-7 lg:mt-56">
            <h2 className="display text-[2.25rem] leading-[1.02] sm:text-[3.25rem]">
              When someone wants to book, <span className="text-volt">you get their details.</span>
            </h2>
            <p className="mt-6 max-w-[30rem] text-[17px] leading-[1.55] text-ink-muted">
              Their name, how to reach them and what they asked about, saved to your dashboard
              while you&apos;re closed.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============================== 4. Who it's for (inline type) ===== */}
      {/* One run of text at two scales: the business in poster type, the
          question its customers ask set small beside it, flowing and
          wrapping like a sentence instead of sitting in three cards. */}
      <section id="who" className="scroll-mt-16 border-t border-edge">
        <div className="mx-auto max-w-[82rem] px-5 py-24 sm:px-8 lg:py-32">
          <Reveal>
            <h2 className="display max-w-2xl text-[2rem] sm:text-[2.75rem]">
              Made for businesses that get the same questions all day
            </h2>
          </Reveal>
          <Reveal>
            <p className="mt-14 leading-none">
              {WHO.map(({ who, asked }) => (
                <span key={who} className="mr-8 inline-block align-baseline sm:mr-12">
                  <span className="display-poster text-[clamp(3rem,9vw,8.5rem)]">{who}</span>{" "}
                  <span className="mt-1 mb-4 block text-[16px] whitespace-nowrap text-volt sm:mt-0 sm:mb-0 sm:ml-4 sm:inline sm:text-[18px]">
                    &ldquo;{asked}&rdquo;
                  </span>
                </span>
              ))}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===================================== 5. Close (poster, light) === */}
      {/* Mirrors the hero's poster voice so the page is bookended by it.
          Stays on the page's one light ground rather than flipping to black. */}
      <section className="border-t border-edge">
        <div className="mx-auto max-w-[82rem] px-5 py-24 sm:px-8 lg:py-32">
          <Reveal>
            <h2 className="display-poster max-w-[14ch] text-[clamp(3rem,7.5vw,7rem)]">
              Stop answering the same five questions.
            </h2>
            <div className="mt-10 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[28rem] text-[18px] leading-[1.5] text-ink-muted">
                Upload one document, paste one line, and it&apos;s answering your customers today.
              </p>
              <Link href="/signup" className="btn btn-volt self-start px-8 py-3.5 sm:self-auto">
                {CTA_SIGNUP}
                <ArrowRight weight="bold" className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-edge">
        <div className="mx-auto flex max-w-[82rem] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <BrandLink />
          <p className="text-[13px] text-ink-faint">
            A portfolio project.{" "}
            <a
              href={REPO_URL}
              className="focus-ring rounded text-ink-muted underline decoration-edge-strong underline-offset-4 transition hover:text-ink"
            >
              How it&apos;s built
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
