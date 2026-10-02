import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const AUTH_PAGES = ["/login", "/register"];

/**
 * Optimistic auth check from the session cookie only (no database access):
 * signed-out users are sent to /login, signed-in users are kept off the auth pages.
 * API routes do their own checks and return 401.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAuthPage = AUTH_PAGES.includes(pathname);
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
