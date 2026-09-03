import Script from "next/script";
import Link from "next/link";
import { Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-body" });

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEMO_AGENT_ID = process.env.NEXT_PUBLIC_DEMO_AGENT_ID;

export default function DemoPage() {
  return (
    <main
      className={`${display.variable} ${body.variable} min-h-screen bg-[#12142B] px-6 py-16 text-[#F4F2EC]`}
    >
      <div className="mx-auto max-w-xl">
        <Link href="/" className={`${body.className} text-sm text-[#8892B0] hover:text-[#F4F2EC]`}>
          ← frontdesk.ai
        </Link>
        <h1 className={`${display.className} mt-6 text-3xl font-bold`}>Try it live</h1>
        <p className={`${body.className} mt-3 leading-relaxed text-[#C7CAD9]`}>
          This is a real agent, configured with a sample business&apos;s documents,
          running the same pipeline every agent on this site uses: your message is
          embedded, matched against the uploaded content with pgvector similarity
          search, and answered by Gemini grounded in what it actually finds — not
          a canned script. Try asking something the sample docs would actually
          cover, like insurance accepted or office hours.
        </p>
        <p className={`${body.className} mt-3 text-sm text-[#8892B0]`}>
          Open the chat bubble in the bottom-right corner.
        </p>

        {!DEMO_AGENT_ID && (
          <p className={`${body.className} mt-8 rounded-lg border border-[#E8A33D]/30 bg-[#181B36] p-4 text-sm text-[#E8A33D]`}>
            Demo agent not configured — set <code>NEXT_PUBLIC_DEMO_AGENT_ID</code> in
            the environment to enable this page.
          </p>
        )}
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
