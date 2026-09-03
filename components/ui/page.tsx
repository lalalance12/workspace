import type { ReactNode } from "react";

/**
 * The page furniture every route shares: a title with a mono count beside it,
 * a brand hairline under it, and a consistent way to say "there is nothing
 * here yet".
 *
 * These are components rather than a copied block of JSX because the four
 * routes drifted apart the moment they each owned their own header.
 */
export function PageHeader({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl">{title}</h1>
        {meta && <span className="annotation">{meta}</span>}
        {action}
      </div>
      <hr className="rule-brand mt-4" />
    </header>
  );
}

/**
 * An empty screen is an invitation to act, so it always carries the next step
 * rather than only reporting the absence.
 */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="panel rise-in mx-auto mt-6 max-w-md px-8 py-12 text-center">
      <p
        aria-hidden="true"
        className="mx-auto mb-5 h-1 w-12 rounded-full"
        style={{ backgroundImage: "var(--gradient-brand)" }}
      />
      <p className="text-lg font-medium">{title}</p>
      {hint && <p className="mt-2 text-sm text-[var(--ink-soft)]">{hint}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

/** A bordered surface. Nothing else — anything more belongs to the caller. */
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`panel ${className}`}>{children}</div>;
}
