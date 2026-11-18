import { sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { memberId, photoUrl, SEED_PROFILES } from "@/server/seed/profiles";

/**
 * Upserts the swipeable member profiles. Safe to run on every deploy: rows are
 * keyed by deterministic ids, so it never creates duplicates and picks up edits
 * made to the seed file.
 */
export async function seedMembers(db: Db): Promise<number> {
  const rows = SEED_PROFILES.map((profile, index) => ({
    id: memberId(index + 1),
    kind: "member" as const,
    name: profile.name,
    age: profile.age,
    photoUrl: photoUrl(profile.photo),
    bio: profile.bio,
    location: profile.location,
    interests: profile.interests,
  }));

  await db
    .insert(users)
    .values(rows)
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: sql`excluded.name`,
        age: sql`excluded.age`,
        photoUrl: sql`excluded.photo_url`,
        bio: sql`excluded.bio`,
        location: sql`excluded.location`,
        interests: sql`excluded.interests`,
      },
    });

  return rows.length;
}
