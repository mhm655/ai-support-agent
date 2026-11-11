import Script from "next/script";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { BrandLink } from "@/components/Brand";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEMO_AGENT_ID = process.env.NEXT_PUBLIC_DEMO_AGENT_ID;

export const metadata: Metadata = { title: "Live demo" };

/*
 * Things to type, each next to what it shows. These replaced three numbered
 * icon cards that explained the pipeline (embeddings, pgvector) to a reader
 * who came here to try the thing, not to review how it is built. The README
 * is the home for that explanation.
 */
const TRY = [
  {
    ask: "What's available in Boston under $4 million?",
    shows: "It answers from the listings document, with the real prices in it.",
  },
  {
    ask: "How do I schedule a viewing?",
    shows: "It answers from the document about how the company works.",
  },
  {
    ask: "Something the documents don't cover.",
    shows: "It says it doesn't know and offers to have someone get back to you. It does not guess.",
  },
];

export default function DemoPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Same bar as the landing page, minus the section links. */}
      <header className="border-b border-edge">
        <div className="mx-auto flex h-16 max-w-[82rem] items-center justify-between px-5 sm:px-8">
          <BrandLink />
          <Link href="/signup" className="btn btn-primary px-4 py-2 text-[14px]">
            Get started free
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-[82rem] px-5 pt-12 pb-24 sm:px-8 lg:pt-16 lg:pb-32">
          <h1 className="display-poster text-[clamp(3.75rem,10vw,9.5rem)] text-ink">
            <span className="poster-line">
              <span className="poster-in">Try to</span>
            </span>
            <span className="poster-line sm:pl-[14vw]">
              <span className="poster-in poster-in-2">catch it out.</span>
            </span>
          </h1>

          <div className="hero-in-2 mt-12 max-w-[34rem] lg:mt-16">
            <p className="text-[19px] leading-[1.45] text-ink-muted">
              <span className="font-semibold text-ink">This is a real agent, not a script.</span> It
              was given two documents from NOVA, a made-up property firm: how the company works,
              and its current listings. That is everything it knows.
            </p>

            {DEMO_AGENT_ID ? (
              <p className="mt-6 text-[16px] leading-relaxed text-ink">
                The chat is the round button in the bottom-right corner, where it would sit on your
                own site.
              </p>
            ) : (
              <p className="mt-6 border-l-2 border-bad pl-4 text-[15px] leading-relaxed text-ink-muted">
                The demo agent is not configured. Set{" "}
                <code className="font-mono text-[13px] text-ink">NEXT_PUBLIC_DEMO_AGENT_ID</code> in
                the environment to enable this page.
              </p>
            )}
          </div>

          <h2 className="display mt-24 text-[2rem] sm:text-[2.75rem] lg:mt-32">Things to ask</h2>
          <ul className="mt-10 divide-y divide-edge border-y border-edge">
            {TRY.map(({ ask, shows }) => (
              <li
                key={ask}
                className="grid grid-cols-1 gap-3 py-8 lg:grid-cols-12 lg:items-baseline lg:gap-8 lg:py-10"
              >
                <p className="display text-[1.5rem] leading-[1.1] sm:text-[2rem] lg:col-span-7">
                  {ask}
                </p>
                <p className="text-[17px] leading-[1.55] text-ink-muted lg:col-span-4 lg:col-start-9">
                  {shows}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link href="/signup" className="btn btn-volt px-6 py-3">
              Build one for your business
              <ArrowRight weight="bold" className="h-4 w-4" />
            </Link>
            <Link
              href="/#how"
              className="focus-ring rounded text-[15px] text-ink-muted underline decoration-edge-strong underline-offset-4 transition hover:text-ink"
            >
              How it works
            </Link>
          </div>
        </div>
      </main>

      {DEMO_AGENT_ID && (
        <Script
          src="/widget.js"
          data-agent-id={DEMO_AGENT_ID}
          data-api-url={API_URL}
          strategy="afterInteractive"
        />
      )}
    </div>
  );
}
