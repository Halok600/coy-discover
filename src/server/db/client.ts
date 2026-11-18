import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Driver-agnostic database handle. Both the `pg` pool (Neon, production) and
 * PGlite (embedded Postgres for local dev, tests and CI) satisfy this type, so
 * services never know which one they are talking to.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");
export const LOCAL_DATA_DIR = path.join(process.cwd(), ".data", "pglite");

/** Embedded Postgres. Pass no `dataDir` for an in-memory database (tests). */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

/** Real Postgres over TCP. Migrations are applied by `npm run db:migrate`. */
export async function createPgDb(connectionString: string): Promise<Db> {
  const [{ Pool }, { drizzle }] = await Promise.all([
    import("pg"),
    import("drizzle-orm/node-postgres"),
  ]);
  // A tiny pool per serverless instance; Neon's pooler fans connections in.
  const pool = new Pool({ connectionString, max: 3 });
  return drizzle({ client: pool, schema });
}

const globalForDb = globalThis as unknown as { __coyDb?: Promise<Db> };

/**
 * Process-wide database singleton (kept on `globalThis` so dev-server hot
 * reloads don't open a second connection). With `DATABASE_URL` set it uses
 * Postgres; without it, it boots an embedded database and seeds it, so
 * `npm run dev` works with zero setup.
 */
export function getDb(): Promise<Db> {
  globalForDb.__coyDb ??= initDb().catch((error) => {
    globalForDb.__coyDb = undefined; // allow a retry on the next request
    throw error;
  });
  return globalForDb.__coyDb;
}

async function initDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return createPgDb(url);

  // PGLITE_DATA_DIR lets the e2e suite use a throwaway database.
  const dataDir = process.env.PGLITE_DATA_DIR
    ? path.resolve(process.env.PGLITE_DATA_DIR)
    : LOCAL_DATA_DIR;
  const db = await createPgliteDb(dataDir);
  const { seedMembers } = await import("@/server/seed/seed");
  await seedMembers(db);
  return db;
}
