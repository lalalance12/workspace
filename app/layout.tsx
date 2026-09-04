import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";

import { siteURL } from "@/lib/site-url";
import "./globals.css";

/**
 * Three faces, three jobs.
 *
 * Bricolage Grotesque carries the personality: it has real quirks in the
 * counters and a variable width axis, so headings and the status text people
 * write look drawn rather than set. Instrument Sans stays underneath it for UI,
 * where character would just be noise. Plex Mono holds anything that is data —
 * timestamps, ticket refs, join codes.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/**
 * One sentence, used as the meta description, the OG and Twitter description,
 * and the manifest's. It says what the thing is, what it replaces, and what is
 * distinctive about it, in that order — a description that only said "notes" or
 * "collaboration" would describe a different product and attract people looking
 * for one.
 */
const DESCRIPTION =
  "An ambient status board that replaces the daily standup. See what your team is working on without asking — and watch each status fade as it goes stale.";

/**
 * Everything except the landing page is behind auth and carries this noindex.
 *
 * That default is deliberate rather than accidental: without it every deep link
 * a crawler finds redirects into /login, and the sign-in form becomes the only
 * page on the domain that can rank. `/` sets `index: true` to opt back in — one
 * indexable page, which is one more than there was.
 *
 * Note how the noindex pairs with robots.ts, which stays permissive on purpose.
 * A crawler told to Disallow never fetches the page, so it never reads this
 * tag, and a URL someone linked from elsewhere can still surface as a bare
 * listing you have no way left to suppress. Disallow hides a page from the
 * crawler; noindex hides it from the index. The second one is what we want.
 *
 * The rest of this is for the unfurl. Nudges send people to Slack, so Workspace
 * links get pasted into Slack, and each one used to arrive as the bare word
 * "Workspace" with no image and no sentence.
 */
export const metadata: Metadata = {
  // opengraph-image and the manifest resolve against this. Without it Next
  // emits a relative og:image, which unfurlers drop on the floor.
  metadataBase: new URL(siteURL()),
  title: { default: "Workspace", template: "%s · Workspace" },
  description: DESCRIPTION,
  applicationName: "Workspace",
  openGraph: {
    type: "website",
    siteName: "Workspace",
    title: "Workspace",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Workspace",
    description: DESCRIPTION,
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // --canvas, in the one spelling browser chrome understands. Android's toolbar
  // and the iOS status bar take this; unset, they put a strip of default grey
  // above a warm off-white page — the exact seam the palette exists to avoid.
  themeColor: "#f8f6fd",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The font variables go on <html>, not <body>. --font-sans and friends are
  // declared in @theme, which lands on :root, and a var() inside a custom
  // property is substituted against the element that DECLARES it. With the
  // faces defined one level down on <body>, --font-sans resolved to the
  // guaranteed-invalid value and every element fell back to Times New Roman.
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${instrumentSans.variable} ${plexMono.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
