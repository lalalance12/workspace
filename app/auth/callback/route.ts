import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * OAuth and magic-link landing. Exchanges the code for a session cookie.
 *
 * Middleware forwards any ?code= that lands elsewhere here, so this is the one
 * place the exchange happens no matter which URL Supabase actually sent the
 * person to.
 *
 * Redirects are built from the request origin rather than the configured site
 * URL: whatever host the person is holding is the host their session cookie has
 * to be set on, and sending them to a different origin mid-exchange would drop
 * the cookie they just earned.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // Supabase reports a refused link in the query string. Pass it on rather than
  // attempting an exchange that cannot succeed.
  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Only same-origin paths, so ?next= can't be used to bounce someone offsite.
  const requested = searchParams.get("next") ?? "/board";
  const next = requested.startsWith("/") && !requested.startsWith("//")
    ? requested
    : "/board";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
