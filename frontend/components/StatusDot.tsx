/*
 * The small pulsing "live" dot. Conveys real state (this preview is
 * connected and answering) rather than decorating a label, which is the
 * only reason to use a coloured dot at all.
 */
export default function StatusDot({ className = "" }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`} aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
    </span>
  );
}
