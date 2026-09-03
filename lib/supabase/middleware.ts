import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/** Routes reachable without a session. */
const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * Refreshes the auth session on every request and redirects signed-out users
 * to /login. Server Components cannot write cookies, so this is the only place
 * a refreshed token gets persisted.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Always getUser(), never getSession(): only getUser() revalidates the token
  // with the auth server. Do not put logic between this call and the return.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const code = request.nextUrl.searchParams.get("code");
  const isAuthRoute = pathname.startsWith("/auth/");

  /**
   * A sign-in code that arrived somewhere other than /auth/callback.
   *
   * Supabase honours emailRedirectTo only if the origin is on the project's
   * Redirect URLs allowlist. When it isn't, the redirect is dropped silently
   * and the person is sent to the project's Site URL instead — which lands them
   * on "/" holding a perfectly good code. Without this they would be bounced
   * straight to /login and the code discarded, so a misconfigured allowlist
   * reads as "the link doesn't work" rather than as the config problem it is.
   *
   * Forward it to the exchange instead of throwing it away. This is a safety
   * net, not a substitute for the allowlist: fix that too, or every sign-in
   * keeps taking the long way round.
   */
  if (code && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    // Carry `next` through if it was set; drop everything else.
    const next = request.nextUrl.searchParams.get("next");
    url.search = "";
    url.searchParams.set("code", code);
    if (next) url.searchParams.set("next", next);
    return redirectToUrl(url, response);
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!user && !isPublic) return redirectTo("/login", request, response);
  if (user && pathname === "/login") return redirectTo("/board", request, response);

  return response;
}

/**
 * getUser() may have rotated the refresh token, in which case setAll wrote the
 * replacement onto `response`. A bare NextResponse.redirect() would drop those
 * cookies, leaving the browser holding a token the auth server has already
 * revoked — which loops: every hop refreshes, every hop discards, nothing ever
 * sticks. Carry the cookies across.
 */
function redirectTo(pathname: string, request: NextRequest, from: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  // Don't drag a spent ?code= or ?error= onto the next page.
  url.search = "";
  return redirectToUrl(url, from);
}

function redirectToUrl(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
