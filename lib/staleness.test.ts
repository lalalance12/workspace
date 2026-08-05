import { describe, expect, it } from "vitest";

import {
  DECAY_THRESHOLDS_MS,
  decayFor,
  decayTierFor,
  formatAge,
  isSignedOff,
} from "./staleness";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("decayTierFor", () => {
  it("is fresh under an hour", () => {
    expect(decayTierFor(0)).toBe("fresh");
    expect(decayTierFor(59 * MINUTE)).toBe("fresh");
  });

  it("softens from one to three hours", () => {
    expect(decayTierFor(1 * HOUR)).toBe("soft");
    expect(decayTierFor(2 * HOUR + 59 * MINUTE)).toBe("soft");
  });

  it("curls from three to six hours", () => {
    expect(decayTierFor(3 * HOUR)).toBe("curl");
    expect(decayTierFor(5 * HOUR)).toBe("curl");
  });

  it("treats exactly six hours as still curling, per the 3-6h band", () => {
    expect(decayTierFor(DECAY_THRESHOLDS_MS.curl)).toBe("curl");
  });

  it("goes stale past six hours", () => {
    expect(decayTierFor(6 * HOUR + 1)).toBe("stale");
    expect(decayTierFor(30 * HOUR)).toBe("stale");
  });
});

describe("formatAge", () => {
  it("reads NOW under a minute", () => {
    expect(formatAge(0)).toBe("NOW");
    expect(formatAge(59_000)).toBe("NOW");
  });

  it("reads minutes under an hour", () => {
    expect(formatAge(20 * MINUTE)).toBe("20M");
  });

  it("floors to whole hours past an hour", () => {
    expect(formatAge(7 * HOUR + 45 * MINUTE)).toBe("7H");
  });
});

describe("decayFor", () => {
  const now = new Date("2026-08-05T12:00:00Z").getTime();
  const at = (hoursAgo: number) =>
    new Date(now - hoursAgo * HOUR).toISOString();

  it("annotates a stale note the way the board draws it", () => {
    const decay = decayFor({ startedAt: at(7), state: "working", now });
    expect(decay.tier).toBe("stale");
    expect(decay.annotation).toBe("STALE · 7H");
  });

  it("leaves fresher notes unannotated", () => {
    expect(decayFor({ startedAt: at(2), state: "working", now }).annotation)
      .toBeNull();
  });

  it("exempts blocked notes from decay however old they are", () => {
    // A blocker should never fade into the background.
    const decay = decayFor({ startedAt: at(11), state: "blocked", now });
    expect(decay.tier).toBe("fresh");
    expect(decay.exempt).toBe(true);
    expect(decay.annotation).toBeNull();
    // The real age is still reported, it just doesn't drive the treatment.
    expect(decay.age).toBe("11H");
  });

  it("never reports a negative age when clocks disagree", () => {
    const decay = decayFor({ startedAt: at(-3), state: "working", now });
    expect(decay.ageMs).toBe(0);
    expect(decay.tier).toBe("fresh");
  });

  it("accepts a Date as readily as an ISO string", () => {
    const asDate = decayFor({ startedAt: new Date(now - 4 * HOUR), state: "working", now });
    expect(asDate.tier).toBe("curl");
  });
});

describe("isSignedOff", () => {
  it("separates finished from stale", () => {
    expect(isSignedOff("done_for_day")).toBe(true);
    expect(isSignedOff("off")).toBe(true);
    expect(isSignedOff("working")).toBe(false);
    expect(isSignedOff("break")).toBe(false);
  });
});
