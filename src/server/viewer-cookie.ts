export const VIEWER_COOKIE = "coy_viewer";
const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

type RequestLike = {
  headers: Headers;
  nextUrl: { protocol: string };
};

/** True when the original request reached us over HTTPS (also behind a proxy). */
function isSecureRequest(request: RequestLike): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  const protocol = forwarded ?? request.nextUrl.protocol.replace(":", "");
  return protocol.split(",")[0].trim() === "https";
}

/**
 * The anonymous "logged-in user" for a visitor. HttpOnly so page scripts can
 * never read or forge it; `Secure` is set whenever the request was HTTPS.
 */
export function viewerCookieOptions(request: RequestLike) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureRequest(request),
    path: "/",
    maxAge: THIRTY_DAYS_IN_SECONDS,
  };
}
