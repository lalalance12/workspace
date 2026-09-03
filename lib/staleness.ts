/**
 * Staleness decay.
 *
 * A status note visibly ages, because a board that hides stale data is lying.
 * This module is the single source of those thresholds: the same function
 * drives the CSS tier on the note, the mono age annotation, and the tests.
 *
 *   < 1h   fresh   lit: full tint, coloured glow, sits flat
 *   1–3h   soft    the glow starts to go
 *   3–6h   curl    colour mostly gone, corner curls, card tilts 1°
 *   > 6h   stale   unlit: neutral and dim, pronounced curl, "STALE · 7H"
 *
 * Blocked notes are exempt. A blocker should never fade into the background.
 */

export type DecayTier = "fresh" | "soft" | "curl" | "stale";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Upper bound of each tier, in ms. The boundaries follow the spec literally:
 * "3–6h" includes 6h, and only "> 6h" is stale.
 */
export const DECAY_THRESHOLDS_MS = {
  fresh: 1 * HOUR,
  soft: 3 * HOUR,
  curl: 6 * HOUR,
} as const;

/** States that are not "stale", they are finished. */
const SIGNED_OFF = new Set(["done_for_day", "off"]);

export function decayTierFor(ageMs: number): DecayTier {
  if (ageMs < DECAY_THRESHOLDS_MS.fresh) return "fresh";
  if (ageMs < DECAY_THRESHOLDS_MS.soft) return "soft";
  if (ageMs <= DECAY_THRESHOLDS_MS.curl) return "curl";
  return "stale";
}

/**
 * The mono annotation shown on the note. Uppercase, tracked, drawn like a
 * dimension label. Under prefers-reduced-motion this label is the whole
 * staleness signal, so it is always rendered, not only when stale.
 */
export function formatAge(ageMs: number): string {
  if (ageMs < MINUTE) return "NOW";
  if (ageMs < HOUR) return `${Math.floor(ageMs / MINUTE)}M`;
  return `${Math.floor(ageMs / HOUR)}H`;
}

export interface Decay {
  tier: DecayTier;
  ageMs: number;
  /** Mono age label, e.g. "20M" or "7H". */
  age: string;
  /** Full annotation for a stale note, e.g. "STALE · 7H". Null otherwise. */
  annotation: string | null;
  /** True when the card is held at full chroma despite its age. */
  exempt: boolean;
}

export function decayFor(input: {
  startedAt: string | Date;
  state: string;
  now?: Date | number;
}): Decay {
  const started =
    input.startedAt instanceof Date
      ? input.startedAt.getTime()
      : new Date(input.startedAt).getTime();

  const now =
    input.now instanceof Date
      ? input.now.getTime()
      : (input.now ?? Date.now());

  const ageMs = Math.max(0, now - started);
  const age = formatAge(ageMs);

  // Blocked is exempt from decay: it holds full chroma and breathes instead.
  const exempt = input.state === "blocked";
  const tier = exempt ? "fresh" : decayTierFor(ageMs);

  return {
    tier,
    ageMs,
    age,
    annotation: tier === "stale" ? `STALE · ${age}` : null,
    exempt,
  };
}

/** Signed off is not the same as gone stale — don't nudge, don't decay-shame. */
export function isSignedOff(state: string): boolean {
  return SIGNED_OFF.has(state);
}
