import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createPgliteDb, type Db } from "@/server/db/client";
import { swipes, users } from "@/server/db/schema";
import { seedMembers } from "@/server/seed/seed";

/** Fresh in-memory Postgres with the real migrations applied and members seeded. */
export async function createTestDb(): Promise<Db> {
  const db = await createPgliteDb();
  await seedMembers(db);
  return db;
}

/** Removes every demo viewer (cascading to their swipes and matches). */
export async function clearViewers(db: Db): Promise<void> {
  await db.delete(users).where(eq(users.kind, "viewer"));
}

export const newViewerId = () => randomUUID();

export async function memberIds(db: Db): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.kind, "member"));
  return rows.map((row) => row.id).sort();
}

/**
 * Test-only peek behind the privacy wall: which members liked this viewer.
 * Production code has no equivalent query and no endpoint exposes it.
 */
export async function admirersOf(db: Db, viewerId: string): Promise<string[]> {
  const rows = await db
    .select({ id: swipes.swiperId })
    .from(swipes)
    .where(and(eq(swipes.targetId, viewerId), eq(swipes.action, "like")));
  return rows.map((row) => row.id).sort();
}

/** A member who has NOT liked this viewer. */
export async function nonAdmirerOf(db: Db, viewerId: string): Promise<string> {
  const admirers = new Set(await admirersOf(db, viewerId));
  const candidate = (await memberIds(db)).find((id) => !admirers.has(id));
  if (!candidate) throw new Error("Every member is an admirer");
  return candidate;
}
