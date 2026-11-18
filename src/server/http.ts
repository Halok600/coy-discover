import { randomUUID } from "node:crypto";
import { connection, NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import type { ApiErrorBody } from "@/lib/types";
import { getDb, type Db } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { ensureViewer } from "@/server/services/viewer";
import { viewerIdSchema } from "@/server/validation";
import { VIEWER_COOKIE, viewerCookieOptions } from "@/server/viewer-cookie";

/** Every API response is per-visitor, so none of it may be cached. */
const NO_STORE = { "Cache-Control": "no-store" } as const;

export function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function errorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: NO_STORE },
    );
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: where + issue.message } },
      { status: 400, headers: NO_STORE },
    );
  }
  // Never leak internals (stack traces, SQL) to the client.
  console.error("Unhandled API error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
    { status: 500, headers: NO_STORE },
  );
}

/** Parses a JSON body, turning malformed JSON into a 400 instead of a 500. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      "Request body must be valid JSON.",
    );
  }
}

async function resolveViewer(db: Db, request: NextRequest) {
  const parsed = viewerIdSchema.safeParse(
    request.cookies.get(VIEWER_COOKIE)?.value,
  );
  if (parsed.success && (await ensureViewer(db, parsed.data))) {
    return { viewerId: parsed.data, isNew: false };
  }
  // No cookie, a malformed one, or one naming a seeded member: start fresh.
  const viewerId = randomUUID();
  await ensureViewer(db, viewerId);
  return { viewerId, isNew: true };
}

type ViewerContext = { db: Db; viewerId: string; request: NextRequest };
type ViewerResult = { body: unknown; status?: number };

/**
 * Wraps a route handler for the demo's single "logged-in user": resolves the
 * visitor from their cookie (creating them on first contact), runs the
 * handler and maps any failure onto the standard error envelope.
 */
export function viewerRoute(
  handler: (context: ViewerContext) => Promise<ViewerResult>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Per-visitor data: never prerender at build time (Cache Components).
    // Kept outside the try/catch on purpose: during prerendering connection()
    // rejects to stop it, and that signal must propagate, not become a 500.
    await connection();
    try {
      const db = await getDb();
      const { viewerId, isNew } = await resolveViewer(db, request);
      const { body, status } = await handler({ db, viewerId, request });
      const response = jsonResponse(body, status);
      if (isNew) {
        response.cookies.set(
          VIEWER_COOKIE,
          viewerId,
          viewerCookieOptions(request),
        );
      }
      return response;
    } catch (error) {
      return errorResponse(error);
    }
  };
}
