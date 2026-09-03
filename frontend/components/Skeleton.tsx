/*
 * Loading placeholder. aria-hidden by default — a screen reader gets
 * nothing useful from a shimmering box, and the real content announces
 * itself when it lands.
 */
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton rounded-2xl border border-line bg-card/60 ${className}`}
    />
  );
}
