import { count, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { matches, swipes, users } from "@/server/db/schema";
import { memberId } from "@/server/seed/profiles";
import { getFeed } from "@/server/services/feed";
import { listMatches } from "@/server/services/matches";
import { recordSwipe } from "@/server/services/swipe";
import {
  admirerCount,
  cleanupIdleViewers,
  ensureViewer,
  resetViewer,
} from "@/server/services/viewer";
import {
  admirersOf,
  clearViewers,
  createTestDb,
  memberIds,
  newViewerId,
} from "../helpers/db";

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

describe("viewer lifecycle", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });
  beforeEach(async () => {
    await clearViewers(db);
  });

  it("creates a viewer with 8 to 10 admirers, all seeded members", async () => {
    const viewer = newViewerId();
    expect(await ensureViewer(db, viewer)).toBe(true);

    const admirers = await admirersOf(db, viewer);
    expect(admirers).toHaveLength(admirerCount(viewer));
    expect(admirers.length).toBeGreaterThanOrEqual(8);
    expect(admirers.length).toBeLessThanOrEqual(10);
    const members = new Set(await memberIds(db));
    expect(admirers.every((id) => members.has(id))).toBe(true);
  });

  it("keeps admirerCount within 8..10 for any id", () => {
    for (let i = 0; i < 256; i++) {
      const id = `${i.toString(16).padStart(2, "0")}000000-0000-4000-8000-000000000000`;
      expect(admirerCount(id)).toBeGreaterThanOrEqual(8);
      expect(admirerCount(id)).toBeLessThanOrEqual(10);
    }
  });

  it("picks different admirers for different viewers", async () => {
    const [a, b] = [newViewerId(), newViewerId()];
    await ensureViewer(db, a);
    await ensureViewer(db, b);
    expect(await admirersOf(db, a)).not.toEqual(await admirersOf(db, b));
  });

  it("is idempotent, even under concurrent first requests", async () => {
    const viewer = newViewerId();
    await Promise.all(
      Array.from({ length: 8 }, () => ensureViewer(db, viewer)),
    );
    await ensureViewer(db, viewer);

    const [rows] = await db
      .select({ total: count() })
      .from(users)
      .where(eq(users.id, viewer));
    expect(rows.total).toBe(1);
    expect(await admirersOf(db, viewer)).toHaveLength(admirerCount(viewer));
  });

  it("refuses to treat a seeded member's id as a viewer", async () => {
    expect(await ensureViewer(db, memberId(1))).toBe(false);
  });

  it("reset restores a full deck, no matches, and the same admirers", async () => {
    const viewer = newViewerId();
    await ensureViewer(db, viewer);
    const admirersBefore = await admirersOf(db, viewer);
    const total = (await memberIds(db)).length;

    await recordSwipe(db, viewer, admirersBefore[0], "like"); // a match
    for (const id of admirersBefore.slice(1, 5)) {
      await recordSwipe(db, viewer, id, "pass");
    }
    expect((await listMatches(db, viewer)).matches).toHaveLength(1);
    // 5 swiped: everything left fits in one page of 30.
    const before = await getFeed(db, viewer, 30);
    expect(before.profiles).toHaveLength(total - 5);
    expect(before.hasMore).toBe(false);

    await resetViewer(db, viewer);

    expect((await listMatches(db, viewer)).matches).toHaveLength(0);
    // Nothing swiped any more: all members are back, so a page of 30 overflows.
    const after = await getFeed(db, viewer, 30);
    expect(after.profiles).toHaveLength(30);
    expect(after.hasMore).toBe(true);
    expect(await admirersOf(db, viewer)).toEqual(admirersBefore);
    const [mine] = await db
      .select({ total: count() })
      .from(swipes)
      .where(eq(swipes.swiperId, viewer));
    expect(mine.total).toBe(0);
  });

  it("reset never touches another viewer", async () => {
    const [a, b] = [newViewerId(), newViewerId()];
    await ensureViewer(db, a);
    await ensureViewer(db, b);
    const [target] = await admirersOf(db, b);
    await recordSwipe(db, b, target, "like");

    await resetViewer(db, a);

    expect((await listMatches(db, b)).matches).toHaveLength(1);
  });
});

describe("idle viewer cleanup", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });
  beforeEach(async () => {
    await clearViewers(db);
  });

  async function insertViewer(createdAt: Date, lastSwipeAt?: Date) {
    const id = newViewerId();
    await db
      .insert(users)
      .values({ id, kind: "viewer", name: "You", createdAt });
    if (lastSwipeAt) {
      await db.insert(swipes).values({
        swiperId: id,
        targetId: memberId(1),
        action: "pass",
        createdAt: lastSwipeAt,
      });
    }
    return id;
  }

  it("removes old viewers with no recent swipes, along with their data", async () => {
    const idle = await insertViewer(daysAgo(30), daysAgo(20));
    expect(await cleanupIdleViewers(db)).toBe(1);

    const rows = await db.select().from(users).where(eq(users.id, idle));
    expect(rows).toHaveLength(0);
    const orphaned = await db
      .select()
      .from(swipes)
      .where(eq(swipes.swiperId, idle));
    expect(orphaned).toHaveLength(0);
  });

  it("keeps old viewers who swiped recently, and brand-new viewers", async () => {
    const active = await insertViewer(daysAgo(30), daysAgo(1));
    const fresh = await insertViewer(daysAgo(1));

    expect(await cleanupIdleViewers(db)).toBe(0);

    const kept = await db.select({ id: users.id }).from(users);
    const ids = kept.map((row) => row.id);
    expect(ids).toContain(active);
    expect(ids).toContain(fresh);
  });

  it("never deletes seeded members", async () => {
    await insertViewer(daysAgo(60));
    await cleanupIdleViewers(db, { now: new Date(Date.now() + 365 * DAY) });
    const [row] = await db
      .select({ total: count() })
      .from(users)
      .where(eq(users.kind, "member"));
    expect(row.total).toBe((await memberIds(db)).length);
  });

  it("removes matches belonging to deleted viewers", async () => {
    const id = await insertViewer(daysAgo(30));
    const [other] = await memberIds(db);
    const [userA, userB] = id < other ? [id, other] : [other, id];
    await db.insert(matches).values({ userA, userB });

    await cleanupIdleViewers(db);

    const [row] = await db.select({ total: count() }).from(matches);
    expect(row.total).toBe(0);
  });
});
