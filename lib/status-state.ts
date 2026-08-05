/**
 * Status states and how they read on paper.
 *
 * The enum here must stay in step with public.status_state in
 * supabase/migrations/20260805090000_extensions_and_types.sql. Regenerate
 * lib/database.types.ts after any migration and this list is type-checked
 * against it by lib/status-state.test.ts.
 */

export const STATUS_STATES = [
  "working",
  "reviewing",
  "blocked",
  "in_meeting",
  "break",
  "done_for_day",
  "off",
] as const;

export type StatusState = (typeof STATUS_STATES)[number];

interface StatePresentation {
  /** Button/label text. Plain and specific. */
  label: string;
  /** CSS colour token for the note ground. */
  noteColor: string;
  /** Ink colour, for the signal-red case where the ground goes dark. */
  inkColor: string;
  /** Signed-off states sit desaturated; they are finished, not stale. */
  muted: boolean;
}

export const STATE_PRESENTATION: Record<StatusState, StatePresentation> = {
  working: {
    label: "Working",
    noteColor: "var(--note-plain)",
    inkColor: "var(--ink)",
    muted: false,
  },
  reviewing: {
    label: "Reviewing",
    noteColor: "var(--note-cyan)",
    inkColor: "var(--ink)",
    muted: false,
  },
  blocked: {
    // The only alarming colour in the product.
    label: "Blocked",
    noteColor: "var(--signal)",
    inkColor: "var(--paper)",
    muted: false,
  },
  in_meeting: {
    label: "In a meeting",
    noteColor: "var(--note-rose)",
    inkColor: "var(--ink)",
    muted: false,
  },
  break: {
    label: "On a break",
    noteColor: "var(--note-mint)",
    inkColor: "var(--ink)",
    muted: false,
  },
  done_for_day: {
    label: "Done for the day",
    noteColor: "var(--paper-deep)",
    inkColor: "var(--ink-soft)",
    muted: true,
  },
  off: {
    label: "Off",
    noteColor: "var(--paper-deep)",
    inkColor: "var(--ink-soft)",
    muted: true,
  },
};

export function presentationFor(state: string): StatePresentation {
  return (
    STATE_PRESENTATION[state as StatusState] ?? STATE_PRESENTATION.working
  );
}
