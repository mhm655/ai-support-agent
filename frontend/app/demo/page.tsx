import Script from "next/script";
import Link from "next/link";
import type { Metadata } from "next";
import { BrandLink } from "@/components/Brand";
import { ArrowLeftIcon, ChatIcon, DocumentIcon, SparkIcon } from "@/lib/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEMO_AGENT_ID = process.env.NEXT_PUBLIC_DEMO_AGENT_ID;

export const metadata: Metadata = { title: "Live demo" };

const STEPS = [
  {
    icon: DocumentIcon,
    title: "It only knows the sample docs",
    body: "A fictional dental practice's hours, insurance list and price sheet. Nothing else was pre-written.",
  },
  {
    icon: SparkIcon,
    title: "Your question gets embedded",
    body: "Then matched against those documents with a pgvector similarity search before anything is generated.",
  },
  {
    icon: ChatIcon,
    title: "The answer is grounded",
    body: "Gemini writes the reply from the passages that came back, and says so when the docs don't cover it.",
  },
];

export default function DemoPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="relative mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-16">
        <div className="flex items-center justify-between gap-4">
          <BrandLink />
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-dusk transition hover:text-cream"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Link>
        </div>

        <p className="eyebrow mt-14">Live demo</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.06] tracking-[-0.03em] sm:text-5xl">
          <span>Ask it something</span>
          <br />
          <span className="text-amber">it wasn&apos;t told to expect.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-mist">
          This is a real agent running the same pipeline every agent on this site uses, not a canned
          script. Try asking what insurance is accepted, or when they&apos;re open on a Saturday.
        </p>

        {DEMO_AGENT_ID ? (
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-sm text-mist">
            <span aria-hidden="true" className="text-lg leading-none">
              ↘
            </span>
            Open the chat bubble in the bottom-right corner
          </p>
        ) : (
          <p className="mt-6 rounded-2xl border border-amber/30 bg-amber/[0.07] px-4 py-3.5 text-sm leading-relaxed text-amber">
            Demo agent not configured. Set{" "}
            <code className="font-mono">NEXT_PUBLIC_DEMO_AGENT_ID</code> in the environment to enable
            this page.
          </p>
        )}

        <ol className="mt-14 flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card flex items-start gap-4 p-5">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-well text-amber"
              >
                <step.icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="font-display text-[15px] font-bold tracking-tight text-cream">
                  <span className="mr-2 font-mono text-[11px] font-normal text-dusk">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {step.title}
                </h2>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-mist">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/signup" className="btn btn-primary px-6 py-3">
            Build your own
          </Link>
          <Link href="/" className="btn btn-ghost px-6 py-3">
            How it works
          </Link>
        </div>
      </div>

      {DEMO_AGENT_ID && (
        <Script
          src="/widget.js"
          data-agent-id={DEMO_AGENT_ID}
          data-api-url={API_URL}
          strategy="afterInteractive"
        />
      )}
    </main>
  );
}
