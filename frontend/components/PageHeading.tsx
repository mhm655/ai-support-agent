/*
 * Title + supporting line + optional right-hand action, with consistent
 * spacing. Used at the top of each dashboard screen.
 */
export default function PageHeading({
  title,
  description,
  action,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-cream sm:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-mist">{description}</p>}
      </div>
      {action}
    </div>
  );
}
