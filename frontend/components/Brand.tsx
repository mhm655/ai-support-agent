import Link from "next/link";

/*
 * A typographic wordmark with a single solid square, rather than a glyph in
 * a rounded box. The box-with-an-icon is the default startup logo; a mark
 * this simple reads as more deliberate and survives being rendered at 16px
 * in a browser tab.
 */
export function Wordmark({ invert = false }: { invert?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="block h-[13px] w-[13px] shrink-0 rounded-[2px] bg-volt"
      />
      <span
        className={`font-display text-[16px] font-bold tracking-[-0.03em] ${
          invert ? "text-bone" : "text-ink"
        }`}
      >
        frontdesk<span className="text-volt">.ai</span>
      </span>
    </span>
  );
}

export function BrandLink({
  href = "/",
  invert = false,
  className = "",
}: {
  href?: string;
  invert?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`focus-ring inline-flex items-center rounded transition hover:opacity-70 ${className}`}
    >
      <Wordmark invert={invert} />
    </Link>
  );
}
