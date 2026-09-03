/*
 * The small pulsing "live" dot used in chat headers. Split out because the
 * landing hero, the dashboard test-chat panel and the widget all want the
 * exact same affordance.
 */
export default function StatusDot({ className = "" }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`} aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
    </span>
  );
}
