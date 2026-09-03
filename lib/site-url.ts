/**
 * The origin a sign-in link comes back to.
 *
 * `window.location.origin` looks like the obvious answer and is the wrong one
 * in production: it makes the emailed link depend on whichever host the person
 * happened to have open — a preview deployment, a LAN IP, localhost — and that
 * link then has to survive a trip through an inbox and a click an hour later,
 * possibly on a different device. So an explicitly configured origin wins and
 * the browser is only the last resort.
 *
 * Set NEXT_PUBLIC_SITE_URL to the canonical production domain. The two Vercel
 * system variables are the fallback, in that order on purpose:
 * NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL is the stable domain, while
 * NEXT_PUBLIC_VERCEL_URL changes with every deployment — fine for a preview,
 * useless in an email.
 *
 * Whatever this returns must also be listed in Supabase under
 * Authentication -> URL Configuration -> Redirect URLs, or the link is
 * rejected on arrival.
 */
export function siteURL(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  if (configured) return normalize(configured);
  if (typeof window !== "undefined") return normalize(window.location.origin);

  return "http://localhost:3000";
}

/** Where the magic link lands. */
export function authCallbackURL(): string {
  return `${siteURL()}/auth/callback`;
}

/** Vercel supplies bare hostnames; a trailing slash breaks the allowlist match. */
function normalize(value: string): string {
  const withProtocol = /^https?:\/\//.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}
