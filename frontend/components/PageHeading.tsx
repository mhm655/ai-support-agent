/*
 * Title + supporting line + optional right-hand action, with consistent
 * spacing. Used at the top of each dashboard screen.
 *
 * There is no eyebrow. The small uppercase label that used to sit above
 * every title ("WORKSPACE", "ACCOUNT") repeated what the nav already says,
 * and a label above every heading is one of the patterns that makes a
 * generated dashboard recognisable.
 */
export default function PageHeading({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="display text-[2.25rem] text-ink sm:text-[2.75rem]">{title}</h1>
        {description && (
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
