import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "token";

const AUTH_ROUTES = ["/auth/login", "/auth/signup", "/auth/forgot-password"];

/**
 * A convenience redirect only, never a security boundary.
 *
 * The session cookie belongs to the API's origin. When the two servers share a
 * parent domain the browser sends it here too and this can skip the auth pages
 * for someone already signed in — but on a split-domain deployment the cookie
 * is invisible to Next entirely. So this deliberately only handles the
 * harmless direction: guarding /dashboard lives in AuthGuard, which asks the
 * API rather than guessing from a cookie it may never see.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

  if (hasSession && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/dashboard/feed", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/:path*"],
};
