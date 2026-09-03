import Link from "next/link";

/*
 * The wordmark, in one place. It appears on the landing page, both auth
 * pages, and every dashboard screen — previously each of those hand-rolled
 * its own copy with slightly different sizing, which is a small part of why
 * the app read as several different products stitched together.
 */
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-[10px] bg-amber text-void ${className}`}
      style={{ boxShadow: "0 1px 0 var(--color-amber-soft) inset, 0 4px 14px -6px rgb(232 163 61 / 0.8)" }}
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-[60%] w-[60%]">
        <path
          d="M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v6A2.5 2.5 0 0 1 14.5 14H9l-3.5 3v-3H5.5A2.5 2.5 0 0 1 3 11.5v-6Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-[17px] font-bold tracking-tight text-cream ${className}`}>
      frontdesk<span className="text-amber">.ai</span>
    </span>
  );
}

export function BrandLink({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`focus-ring inline-flex items-center gap-2.5 rounded-lg transition hover:opacity-85 ${className}`}
    >
      <BrandMark className="h-7 w-7" />
      <Wordmark />
    </Link>
  );
}
