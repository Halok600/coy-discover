import { createPgDb } from "@/server/db/client";
import { seedMembers } from "@/server/seed/seed";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required to seed the database.");
  process.exit(1);
}

const db = await createPgDb(url);
const count = await seedMembers(db);
console.log(`Seeded ${count} member profiles.`);
process.exit(0);
