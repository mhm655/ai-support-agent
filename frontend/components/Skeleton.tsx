/*
 * Loading placeholder. aria-hidden by default — a screen reader gets
 * nothing useful from a shimmering box, and the real content announces
 * itself when it lands.
 */
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton rounded-[var(--radius-control)] bg-paper-sunk ${className}`}
    />
  );
}
