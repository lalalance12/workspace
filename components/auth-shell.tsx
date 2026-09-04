import Link from "next/link";

import { Wordmark } from "@/components/brand-mark";
import { DecayDemo } from "@/components/decay-demo";

/**
 * The frame both /login and /signup sit in.
 *
 * The hero is the product's one real idea rather than a screenshot of it —
 * three cards at three ages, so the first thing anyone sees is a fresh status
 * lit up and a seven-hour-old one drained to near-white. The cards themselves
 * live in components/decay-demo.tsx, shared with the landing page.
 *
 * `now` is computed on the server and passed down, so the cards render
 * identically on both sides of hydration.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: React.ReactNode;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const now = Date.now();

  return (
    <div className="canvas-ambient min-h-dvh">
      <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-16 px-6 py-16 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        <div className="rise-in w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2.5">
            <Wordmark />
          </Link>

          <h1 className="text-3xl leading-[1.15]">{title}</h1>
          <p className="mt-3 mb-8 text-[var(--ink-soft)]">{subtitle}</p>

          {children}

          <div className="mt-8 border-t pt-6 text-sm text-[var(--ink-soft)]" style={{ borderColor: "var(--line)" }}>
            {footer}
          </div>
        </div>

        {/* The demonstration. Hidden on small screens: it is the argument for
            the product, not a control, and it needs room to read. */}
        <div className="hidden lg:block">
          <p className="annotation mb-5">A status ages in public</p>
          <DecayDemo now={now} />
          <p className="mt-5 max-w-md text-sm text-[var(--ink-soft)]">
            Fresh notes hold their colour. Old ones drain towards the paper, so
            a board that has gone quiet looks like it. Blockers never fade.
          </p>
        </div>
      </div>
    </div>
  );
}
