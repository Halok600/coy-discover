import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { createPgliteDb, MIGRATIONS_FOLDER, type Db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { swipes, users } from "@/server/db/schema";
import { seedMembers } from "@/server/seed/seed";

/** Which engine the tests run on: set TEST_DATABASE_URL to use real Postgres. */
export const testBackend = process.env.TEST_DATABASE_URL
  ? "postgres"
  : "pglite";

/**
 * A fresh database with the real migrations applied and members seeded.
 *
 * By default it is an in-memory embedded Postgres. With `TEST_DATABASE_URL`
 * set (an admin connection to a real server), each call creates its own
 * throwaway database on that server instead, so the same suites also run
 * against the production driver with genuinely concurrent connections.
 */
export async function createTestDb(): Promise<Db> {
  const adminUrl = process.env.TEST_DATABASE_URL;
  if (!adminUrl) {
    const db = await createPgliteDb();
    await seedMembers(db);
    return db;
  }

  const name = `coy_test_${randomUUID().replace(/-/g, "")}`;
  const admin = new Pool({ connectionString: adminUrl, max: 1 });
  try {
    await admin.query(`create database ${name}`);
  } finally {
    await admin.end();
  }
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString(), max: 12 });
  const db = drizzle({ client: pool, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
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
