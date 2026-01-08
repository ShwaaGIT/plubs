import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cookie names used for gating
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "plubs_session";
const GUEST_COOKIE = process.env.GUEST_COOKIE_NAME || "plubs_guest";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allowlist routes that should bypass the gate
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/welcome") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup")
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const isGuest = req.cookies.get(GUEST_COOKIE)?.value === "1";

  if (!hasSession && !isGuest) {
    const url = req.nextUrl.clone();
    url.pathname = "/welcome";
    // preserve original destination to enable future return
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Apply to all paths except the allowlist above
  matcher: "/:path*",
};

