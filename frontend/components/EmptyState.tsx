/*
 * Shared "nothing here yet" panel. Every list in the dashboard needs one,
 * and they should look identical rather than each drifting.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-bright bg-card/40 px-6 py-14 text-center">
      {icon && (
        <span
          aria-hidden="true"
          className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-line bg-well text-amber"
        >
          {icon}
        </span>
      )}
      <p className="font-display text-base font-bold text-cream">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-dusk">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
