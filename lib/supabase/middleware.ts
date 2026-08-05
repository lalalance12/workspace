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

  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
