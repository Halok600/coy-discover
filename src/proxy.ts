import { NextResponse, type NextRequest } from "next/server";
import { viewerIdSchema } from "@/server/validation";
import { VIEWER_COOKIE, viewerCookieOptions } from "@/server/viewer-cookie";

/**
 * Hands every visitor an anonymous id cookie when they load a page, before the
 * app makes its first API calls. Issuing it here (rather than lazily in the
 * API) means parallel first requests can never create two different demo users.
 * There is no login: this cookie is the single "logged-in user" of the brief.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const existing = request.cookies.get(VIEWER_COOKIE)?.value;
  if (!viewerIdSchema.safeParse(existing).success) {
    response.cookies.set(
      VIEWER_COOKIE,
      crypto.randomUUID(),
      viewerCookieOptions(request),
    );
  }
  return response;
}

export const config = {
  // Pages only: skip the API, its rewrites, Next internals and static files.
  matcher: [
    "/((?!api|feed|swipe|matches|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
