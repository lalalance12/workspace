import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Workspace",
  description: "An ambient status board. What everyone is working on, at a glance.",
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
