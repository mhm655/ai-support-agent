import Link from "next/link";
import { BrandLink } from "@/components/Brand";

/*
 * Two-column auth chrome in the landing page's poster voice.
 *
 * The rail carries one thing: the headline, set in the condensed poster
 * type and anchored to the bottom. It used to hold that headline small plus
 * three checkmarked selling points, which is the stock shape of a generated
 * SaaS login and also pointless here: anyone on this page already knows
 * what the product does.
 *
 * The form sits directly on the ground with no card around it. A card is
 * for lifting one thing above others; on a page whose only job is the
 * form, the box was decoration.
 *
 * On small screens the rail drops away entirely, since a marketing panel
 * above a login form is just something to scroll past on a phone.
 */
export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden border-r border-edge bg-paper-sunk lg:flex lg:flex-col lg:justify-between lg:p-12">
        <BrandLink />
        <p
          aria-hidden="true"
          className="display-poster text-[clamp(3.5rem,8.5vw,8.5rem)] text-ink"
        >
          <span className="poster-line">
            <span className="poster-in">Someone&apos;s</span>
          </span>
          <span className="poster-line">
            <span className="poster-in">always at</span>
          </span>
          <span className="poster-line">
            <span className="poster-in poster-in-2">the desk.</span>
          </span>
        </p>
      </aside>

      <main className="flex flex-col justify-center px-5 py-14 sm:px-12 lg:px-16">
        <div className="w-full max-w-sm">
          <div className="mb-14 lg:hidden">
            <BrandLink />
          </div>

          <h1 className="display text-[2.5rem] text-ink">{title}</h1>
          {subtitle && (
            <p className="mt-3 text-[16px] leading-relaxed text-ink-muted">{subtitle}</p>
          )}
          {children}

          <p className="mt-8 text-sm text-ink-muted">{footer}</p>

          <p className="mt-12">
            <Link
              href="/"
              className="focus-ring rounded text-[13px] text-ink-faint transition hover:text-ink-muted"
            >
              ← Back to frontdesk.ai
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
