import Link from "next/link";
import { BrandLink } from "@/components/Brand";
import { CheckIcon } from "@/lib/icons";

const PROOF = [
  "Answers from documents you upload, not from a script you have to write",
  "Captures the name and email when a visitor wants to book",
  "Embeds on any site with a single line of HTML",
];

/*
 * Two-panel auth chrome: a brand rail that carries the landing page's
 * identity, and the form itself. On small screens the rail drops away
 * entirely — a marketing panel above a login form is just something to
 * scroll past on a phone.
 */
export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      {/* Brand rail */}
      <aside className="relative hidden overflow-hidden border-r border-line bg-navy lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden="true" className="glow-amber pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
        <div aria-hidden="true" className="grid-lines pointer-events-none absolute inset-0" />

        <div className="relative">
          <BrandLink />
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-[34px] font-extrabold leading-[1.1] tracking-[-0.03em]">
            <span className="text-gradient">Someone&apos;s always</span>
            <br />
            <span className="text-gradient">at the desk.</span>
            <br />
            <span className="text-amber">Even at 2am.</span>
          </h2>

          <ul className="mt-9 flex flex-col gap-4">
            {PROOF.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-mist">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber/15 text-amber"
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative font-mono text-[11px] text-dusk">frontdesk.ai — a portfolio project</p>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col items-center justify-center px-5 py-14 sm:px-8">
        <div aria-hidden="true" className="glow-amber pointer-events-none absolute inset-x-0 top-0 h-64 lg:hidden" />

        <div className="relative w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandLink />
          </div>

          <div className="card p-7 sm:p-8">
            <h1 className="font-display text-[22px] font-bold tracking-tight text-cream">{title}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-mist">{subtitle}</p>
            {children}
          </div>

          <p className="mt-6 text-center text-sm text-dusk">{footer}</p>

          <p className="mt-8 text-center lg:hidden">
            <Link href="/" className="focus-ring rounded text-xs text-dusk transition hover:text-mist">
              ← Back to frontdesk.ai
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
