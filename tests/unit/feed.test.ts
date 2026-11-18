import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { getFeed } from "@/server/services/feed";
import { recordSwipe } from "@/server/services/swipe";
import { ensureViewer } from "@/server/services/viewer";
import {
  clearViewers,
  createTestDb,
  memberIds,
  newViewerId,
} from "../helpers/db";

describe("getFeed", () => {
  let db: Db;
  let viewer: string;
  let total: number;

  beforeAll(async () => {
    db = await createTestDb();
    total = (await memberIds(db)).length;
  });
  beforeEach(async () => {
    await clearViewers(db);
    viewer = newViewerId();
    await ensureViewer(db, viewer);
  });

  async function drain(): Promise<string[]> {
    const ids: string[] = [];
    for (;;) {
      const { profiles, hasMore } = await getFeed(db, viewer, 7);
      for (const profile of profiles) {
        ids.push(profile.id);
        await recordSwipe(db, viewer, profile.id, "pass");
      }
      if (!hasMore) return ids;
    }
  }

  it("serves a deck of at least 30 profiles", () => {
    expect(total).toBeGreaterThanOrEqual(30);
  });

  it("returns at most `limit` profiles and says whether more remain", async () => {
    const page = await getFeed(db, viewer, 5);
    expect(page.profiles).toHaveLength(5);
    expect(page.hasMore).toBe(true);
  });

  it("never includes the viewer or another visitor", async () => {
    const other = newViewerId();
    await ensureViewer(db, other);
    const ids = new Set(await drain());
    expect(ids.has(viewer)).toBe(false);
    expect(ids.has(other)).toBe(false);
  });

  it("serves every member exactly once while swiping through the deck", async () => {
    const ids = await drain();
    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
  });

  it("never shows a profile again once it has been swiped, like or pass", async () => {
    const { profiles } = await getFeed(db, viewer, 6);
    const [liked, passed] = profiles;
    await recordSwipe(db, viewer, liked.id, "like");
    await recordSwipe(db, viewer, passed.id, "pass");

    const next = await getFeed(db, viewer, 30);
    const ids = next.profiles.map((profile) => profile.id);
    expect(ids).not.toContain(liked.id);
    expect(ids).not.toContain(passed.id);
    expect(ids).toHaveLength(Math.min(30, total - 2));
  });

  it("is empty once everything has been swiped", async () => {
    await drain();
    expect(await getFeed(db, viewer, 10)).toEqual({
      profiles: [],
      hasMore: false,
    });
  });

  it("is stable: the same viewer sees the same order on every call", async () => {
    const first = await getFeed(db, viewer, 30);
    const second = await getFeed(db, viewer, 30);
    expect(second).toEqual(first);
  });

  it("orders the deck differently for different viewers", async () => {
    const other = newViewerId();
    await ensureViewer(db, other);
    const mine = (await getFeed(db, viewer, 30)).profiles.map((p) => p.id);
    const theirs = (await getFeed(db, other, 30)).profiles.map((p) => p.id);
    expect(theirs).not.toEqual(mine);
  });

  it("keeps one viewer's swipes out of another viewer's deck", async () => {
    const other = newViewerId();
    await ensureViewer(db, other);
    const before = await getFeed(db, other, 30);

    const [first] = (await getFeed(db, viewer, 3)).profiles;
    await recordSwipe(db, viewer, first.id, "pass");

    expect(await getFeed(db, other, 30)).toEqual(before);
  });
});
