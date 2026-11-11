/*
 * Shared "nothing here yet" block. Every list in the dashboard needs one,
 * and they should look identical rather than each drifting.
 *
 * Plain and left-aligned under a hairline, the way the lists it stands in
 * for are laid out. It used to be a dashed box with a centred icon tile,
 * the stock empty state of every generated dashboard.
 */
export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-t border-edge py-10">
      <p className="font-display text-[20px] font-bold text-ink">{title}</p>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
