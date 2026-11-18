import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/server/db/schema";
import { seedMembers } from "@/server/seed/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to seed the database.");
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const count = await seedMembers(drizzle({ client: pool, schema }));
    console.log(`Seeded ${count} member profiles.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  // Prefer the root cause (e.g. ECONNREFUSED) over a long "Failed query" dump.
  const cause = error instanceof Error ? error.cause : undefined;
  const reported = cause ?? error;
  console.error(reported instanceof Error ? reported.message : reported);
  process.exit(1);
});
