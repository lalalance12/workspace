import type { ComponentProps, ReactNode } from "react";

/**
 * A labelled control.
 *
 * Takes the input as children rather than as a renderInput prop or a pile of
 * pass-through props — Field owns the label, the hint and the spacing and knows
 * nothing about what it wraps. That keeps a mono join-code input and a plain
 * URL input on the same component without either one growing a flag.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="annotation">{label}</span>
      {children}
      {hint && <span className="text-sm text-[var(--ink-soft)]">{hint}</span>}
    </label>
  );
}

/** The one text input in the product. */
export function Input({ className = "", ...rest }: ComponentProps<"input">) {
  return <input {...rest} className={`input ${className}`} />;
}

/** A checkbox and its sentence. The sentence is the label, so it is children. */
export function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--violet)]"
      />
      {children}
    </label>
  );
}

/** Failure, stated. Never a bare apology. */
export function ErrorNote({
  children,
  testId,
}: {
  children: ReactNode;
  testId?: string;
}) {
  return (
    <p role="alert" data-testid={testId} className="error-note rise-in">
      <span
        aria-hidden="true"
        className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--signal)]"
      />
      <span>{children}</span>
    </p>
  );
}
