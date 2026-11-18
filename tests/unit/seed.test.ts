import { count, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { memberId, SEED_PROFILES } from "@/server/seed/profiles";
import { seedMembers } from "@/server/seed/seed";
import { viewerIdSchema } from "@/server/validation";
import { createTestDb } from "../helpers/db";

describe("seed data", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it("defines at least 30 profiles", () => {
    expect(SEED_PROFILES.length).toBeGreaterThanOrEqual(30);
  });

  it("gives every profile the fields the brief asks for", () => {
    for (const profile of SEED_PROFILES) {
      expect(profile.name.trim().length).toBeGreaterThan(0);
      expect(profile.age).toBeGreaterThanOrEqual(18);
      expect(Number.isInteger(profile.photo)).toBe(true);
      expect(profile.photo).toBeGreaterThanOrEqual(1);
      expect(profile.photo).toBeLessThanOrEqual(70);
      expect(profile.location.trim().length).toBeGreaterThan(0);
      expect(profile.bio.trim().length).toBeGreaterThan(20);
      expect(profile.interests.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("uses unique names and unique photos", () => {
    const names = new Set(SEED_PROFILES.map((p) => p.name));
    const photos = new Set(SEED_PROFILES.map((p) => p.photo));
    expect(names.size).toBe(SEED_PROFILES.length);
    expect(photos.size).toBe(SEED_PROFILES.length);
  });

  it("generates ids the API's UUID validation accepts", () => {
    for (let i = 1; i <= SEED_PROFILES.length; i++) {
      expect(viewerIdSchema.safeParse(memberId(i)).success).toBe(true);
    }
  });

  it("stores all members, and re-seeding never duplicates them", async () => {
    await seedMembers(db);
    await seedMembers(db);
    const [row] = await db
      .select({ total: count() })
      .from(users)
      .where(eq(users.kind, "member"));
    expect(row.total).toBe(SEED_PROFILES.length);
  });
});
