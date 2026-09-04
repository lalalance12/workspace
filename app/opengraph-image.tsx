import { ImageResponse } from "next/og";

import { BrandMark } from "@/components/brand-mark";

/**
 * The card a Workspace link turns into when someone pastes it in Slack.
 *
 * Which is not a hypothetical: the whole nudge feature ends with "go check your
 * messages," so links to this app travel through chat by design. This is the
 * only place the product gets to introduce itself to someone who has never
 * signed in, and it was previously the bare word "Workspace".
 *
 * Every colour here is a hex literal, and that is not laziness. This renders
 * through Satori, which supports neither oklch() nor color-mix() — the two
 * things the entire palette in globals.css is built from. Passing a token
 * through would silently render black. The values below are the same colours,
 * converted: --canvas, --ink, --ink-soft, --violet, and the violet mixed down
 * the decay ladder at tint 0.42 and 0.14.
 *
 * That mirroring is a real cost. If the palette moves, this file has to move
 * with it — there is no var() to follow. It is worth it once, for one image.
 */

export const alt =
  "Workspace — an ambient status board that replaces the daily standup.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** --violet, then the same violet at tint 0.42 and 0.14 over --canvas. */
const LADDER = ["#8141e8", "#c6aaf4", "#e7ddfa"];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "76px 84px",
          backgroundColor: "#f8f6fd",
          // The .canvas-ambient wash, flattened to one stop Satori can draw.
          backgroundImage:
            "radial-gradient(circle at 88% 8%, #ece2fb 0%, #f8f6fd 58%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* The mark itself, not the letter W set in whatever face Satori
              falls back to. The same component the header renders, so the
              unfurl, the tab icon and the top of the page cannot drift apart.
              The plate is passed as hex because Satori cannot read the token. */}
          <BrandMark size={68} plate="#8141e8" />
          <div style={{ fontSize: 36, fontWeight: 700, color: "#261e3c" }}>
            Workspace
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -2,
              color: "#261e3c",
              maxWidth: 860,
            }}
          >
            What everyone is working on, at a glance.
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 31,
              color: "#6a657b",
              maxWidth: 780,
            }}
          >
            An ambient status board that replaces the daily standup.
          </div>
        </div>

        {/* The signature idea, reduced to three bars: a status is worth
            something when it is fresh and less every hour it sits there. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 19,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#6a657b",
            }}
          >
            A status ages in public
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            {LADDER.map((colour) => (
              <div
                key={colour}
                style={{
                  width: 208,
                  height: 15,
                  borderRadius: 999,
                  backgroundColor: colour,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
