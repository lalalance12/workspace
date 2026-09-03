/**
 * Status states and how they read on a card.
 *
 * The enum here must stay in step with public.status_state in
 * supabase/migrations/20260805090000_extensions_and_types.sql. Regenerate
 * lib/database.types.ts after any migration.
 *
 * Each state contributes exactly one colour: --state. Everything on the card —
 * the tint gradient, the left edge, the dot, the glow — is mixed from it
 * against the decay tint in globals.css, so a state is one decision rather
 * than five.
 */

export const STATUS_STATES = [
  "working",
  "reviewing",
  "blocked",
  "in_meeting",
  "break",
  "done_for_day",
  "off",
  "other",
] as const;

export type StatusState = (typeof STATUS_STATES)[number];

interface StatePresentation {
  /** Button/label text. Plain and specific. */
  label: string;
  /** The state's single colour token. Drives tint, edge, dot and glow. */
  accent: string;
  /** Ink to use when the accent is painted as a solid fill. */
  onAccent: string;
  /** Signed-off states sit quiet; they are finished, not stale. */
  muted: boolean;
}

export const STATE_PRESENTATION: Record<StatusState, StatePresentation> = {
  working: {
    label: "Working",
    accent: "var(--color-state-working)",
    onAccent: "white",
    muted: false,
  },
  reviewing: {
    label: "Reviewing",
    accent: "var(--color-state-reviewing)",
    onAccent: "white",
    muted: false,
  },
  blocked: {
    // The only state that holds full chroma at any age.
    label: "Blocked",
    accent: "var(--color-state-blocked)",
    onAccent: "white",
    muted: false,
  },
  in_meeting: {
    label: "In a meeting",
    accent: "var(--color-state-meeting)",
    onAccent: "var(--ink)",
    muted: false,
  },
  break: {
    label: "On a break",
    accent: "var(--color-state-break)",
    onAccent: "var(--ink)",
    muted: false,
  },
  done_for_day: {
    label: "Done for the day",
    accent: "var(--color-state-off)",
    onAccent: "white",
    muted: true,
  },
  off: {
    label: "Off",
    accent: "var(--color-state-off)",
    onAccent: "white",
    muted: true,
  },
  // The escape hatch. The card shows the person's own words (custom_label)
  // in place of this generic label whenever one is set.
  other: {
    label: "Other",
    accent: "var(--color-state-other)",
    onAccent: "white",
    muted: false,
  },
};

export function presentationFor(state: string): StatePresentation {
  return STATE_PRESENTATION[state as StatusState] ?? STATE_PRESENTATION.working;
}
