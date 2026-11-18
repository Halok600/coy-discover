import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { jsonResponse } from "@/server/http";

/** GET /api/health: liveness probe that also checks the database connection. */
export async function GET() {
  await connection(); // a live probe must never be prerendered (see http.ts)
  try {
    await (await getDb()).execute(sql`select 1`);
    return jsonResponse({ status: "ok" });
  } catch (error) {
    console.error("Health check failed", error);
    return jsonResponse({ status: "unavailable" }, 503);
  }
}
