import { timingSafeEqual } from "node:crypto";
import { connection, type NextRequest } from "next/server";
import { getDb } from "@/server/db/client";
import { errors } from "@/server/errors";
import { errorResponse, jsonResponse } from "@/server/http";
import { cleanupIdleViewers } from "@/server/services/viewer";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed when the secret is not configured
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

/**
 * GET /api/cron/cleanup: daily Vercel Cron job that removes idle demo visitors.
 * Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
 */
export async function GET(request: NextRequest) {
  await connection(); // request-time only (see http.ts)
  try {
    if (!isAuthorized(request)) throw errors.unauthorized();
    const deleted = await cleanupIdleViewers(await getDb());
    return jsonResponse({ deleted });
  } catch (error) {
    return errorResponse(error);
  }
}
