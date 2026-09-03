/**
 * Placeholders that hold the layout still.
 *
 * Each one is sized to the thing it replaces, so the real content lands in the
 * same place rather than shoving the page around. That, not the shimmer, is
 * what stops navigation feeling wobbly — a centred spinner on an empty page
 * guarantees a jump at the end of every load.
 */

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div aria-hidden="true" className={`skeleton ${className}`} style={style} />;
}

/** Stands in for a PageHeader: title, mono meta, brand rule. */
export function PageHeaderSkeleton({ titleWidth = "9rem" }: { titleWidth?: string }) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Skeleton className="h-8" style={{ width: titleWidth }} />
        <Skeleton className="h-3 w-32" />
      </div>
      <hr className="rule-brand mt-4" />
    </header>
  );
}

/**
 * Stands in for a StatusNote. Matches min-h-44 and the card radius exactly, so
 * the grid does not reflow when the real cards arrive.
 */
export function NoteSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-44 w-full flex-col gap-3 border p-4 pl-5"
      style={{
        borderRadius: "var(--radius-card)",
        borderColor: "var(--line)",
        background: "var(--surface)",
      }}
    >
      <div className="flex items-center gap-2">
        <Skeleton className="size-2.5 rounded-full" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  );
}

/** The card grid used by /board and /timeline. */
export function NoteGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-6"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <NoteSkeleton key={i} />
      ))}
    </div>
  );
}

/** A labelled control: mono label above, input below. */
export function FieldSkeleton({ inputClass = "h-11" }: { inputClass?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className={inputClass} />
    </div>
  );
}
