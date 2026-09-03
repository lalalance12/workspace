import type { ComponentProps } from "react";

/**
 * One button, three named variants.
 *
 * Named variants rather than boolean props on purpose: a component that grows
 * isPrimary / isQuiet / isDanger ends up able to express states nobody meant to
 * allow — primary AND quiet — and needs a cascade of conditionals to forbid
 * them. A union can only ever be one thing.
 *
 * The look lives in globals.css under Controls.
 */
export type ButtonVariant = "primary" | "quiet" | "ghost";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn btn-primary",
  quiet: "btn btn-quiet",
  ghost: "btn btn-ghost",
};

interface Props extends ComponentProps<"button"> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className = "", ...rest }: Props) {
  return <button {...rest} className={`${VARIANT_CLASS[variant]} ${className}`} />;
}
