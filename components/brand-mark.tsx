/**
 * The app mark, and the wordmark it sits in.
 *
 * Same drawing as the favicon — the geometry below is the geometry in
 * scripts/generate-icons.mjs, which emits app/icon.svg and the bitmaps. The
 * header used to show a plain gradient square instead, so the thing in the tab
 * and the thing at the top of the page were two different logos.
 *
 * Inline rather than <img src="/icon.svg">: Next content-hashes the URL of the
 * app/icon.* convention files, so there is no stable path to point at, and a
 * mark this small should not cost a request.
 *
 * Note what this does to the restraint rule in CLAUDE.md. The brand gradient
 * still appears in exactly three places — the wordmark, the primary button, the
 * active nav underline — because the wordmark's gradient is on the word. The
 * plate is flat violet, and it has to stay flat: a gradient here would not
 * survive being 16 pixels wide in a tab, which is the size the mark was drawn
 * for.
 */

/** Grid, radius, stroke and path all mirror scripts/generate-icons.mjs. */
export function BrandMark({
  size = 20,
  plate = "var(--violet)",
  className,
}: {
  size?: number;
  /**
   * The plate colour. Defaults to the token; pass a hex where the renderer
   * cannot read CSS custom properties or oklch() — opengraph-image goes through
   * Satori, which understands neither.
   */
  plate?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="7" fill={plate} />
      <path
        d="M7.6 9.8 L11.8 22.2 L16 14 L20.2 22.2 L24.4 9.8"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Mark plus name. Returned unwrapped, because the four places this appears
 * wrap it differently — a Link to /board in the app bar, a Link to / on the
 * auth screens, a plain span on the landing page where it is already home, and
 * a div during onboarding where there is nowhere yet to go.
 */
export function Wordmark({ size }: { size?: number }) {
  return (
    <>
      <BrandMark size={size} />
      <span className="gradient-text font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
        Workspace
      </span>
    </>
  );
}
