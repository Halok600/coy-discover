import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { MIGRATIONS_FOLDER } from "@/server/db/client";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: MIGRATIONS_FOLDER,
    });
    console.log("Migrations applied.");
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
