import { and, count, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { matches, swipes } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { memberId } from "@/server/seed/profiles";
import { listMatches } from "@/server/services/matches";
import { recordSwipe } from "@/server/services/swipe";
import { ensureViewer } from "@/server/services/viewer";
import {
  admirersOf,
  clearViewers,
  createTestDb,
  newViewerId,
  nonAdmirerOf,
} from "../helpers/db";

async function matchRows(db: Db) {
  const [row] = await db.select({ total: count() }).from(matches);
  return row.total;
}

describe("recordSwipe", () => {
  let db: Db;
  let viewer: string;

  beforeAll(async () => {
    db = await createTestDb();
  });
  beforeEach(async () => {
    await clearViewers(db);
    viewer = newViewerId();
    await ensureViewer(db, viewer);
  });

  it("does not match when you like someone who has not liked you", async () => {
    const stranger = await nonAdmirerOf(db, viewer);
    const result = await recordSwipe(db, viewer, stranger, "like");
    expect(result).toEqual({ matched: false });
    expect(await matchRows(db)).toBe(0);
  });

  it("matches when you like someone who already liked you", async () => {
    const [admirer] = await admirersOf(db, viewer);
    const result = await recordSwipe(db, viewer, admirer, "like");

    expect(result.matched).toBe(true);
    if (!result.matched) throw new Error("unreachable");
    expect(result.match.profile.id).toBe(admirer);
    expect(Number.isNaN(Date.parse(result.match.matchedAt))).toBe(false);
    expect(await matchRows(db)).toBe(1);
  });

  it("never matches on a pass, even when they liked you", async () => {
    const [admirer] = await admirersOf(db, viewer);
    const result = await recordSwipe(db, viewer, admirer, "pass");
    expect(result).toEqual({ matched: false });
    expect(await matchRows(db)).toBe(0);
  });

  it("stores the match once, with the pair in canonical order", async () => {
    const [admirer] = await admirersOf(db, viewer);
    await recordSwipe(db, viewer, admirer, "like");

    const rows = await db.select().from(matches);
    expect(rows).toHaveLength(1);
    expect(rows[0].userA < rows[0].userB).toBe(true);
    expect(new Set([rows[0].userA, rows[0].userB])).toEqual(
      new Set([viewer, admirer]),
    );
  });

  it("makes swipes final: a second swipe is rejected and changes nothing", async () => {
    const [admirer] = await admirersOf(db, viewer);
    await recordSwipe(db, viewer, admirer, "pass");

    // Trying to flip the pass into a like must fail and must not create a match.
    await expect(
      recordSwipe(db, viewer, admirer, "like"),
    ).rejects.toMatchObject({ code: "ALREADY_SWIPED", status: 409 });

    const [stored] = await db
      .select({ action: swipes.action })
      .from(swipes)
      .where(and(eq(swipes.swiperId, viewer), eq(swipes.targetId, admirer)));
    expect(stored.action).toBe("pass");
    expect(await matchRows(db)).toBe(0);
  });

  it("rejects a repeated like on a match without creating a second one", async () => {
    const [admirer] = await admirersOf(db, viewer);
    await recordSwipe(db, viewer, admirer, "like");
    await expect(
      recordSwipe(db, viewer, admirer, "like"),
    ).rejects.toBeInstanceOf(AppError);
    expect(await matchRows(db)).toBe(1);
  });

  it("rejects an unknown profile id", async () => {
    await expect(
      recordSwipe(db, viewer, memberId(9999), "like"),
    ).rejects.toMatchObject({ code: "PROFILE_NOT_FOUND", status: 404 });
  });

  it("rejects swiping on yourself", async () => {
    await expect(recordSwipe(db, viewer, viewer, "like")).rejects.toMatchObject(
      { code: "PROFILE_NOT_FOUND" },
    );
  });

  it("rejects swiping on another visitor", async () => {
    const other = newViewerId();
    await ensureViewer(db, other);
    await expect(recordSwipe(db, viewer, other, "like")).rejects.toMatchObject({
      code: "PROFILE_NOT_FOUND",
    });
  });

  it("lists exactly the mutual matches, newest first", async () => {
    const [first, second, third] = await admirersOf(db, viewer);
    await recordSwipe(db, viewer, first, "like");
    await recordSwipe(db, viewer, second, "pass");
    await recordSwipe(db, viewer, third, "like");

    const { matches: listed } = await listMatches(db, viewer);
    expect(listed.map((m) => m.profile.id)).toEqual([third, first]);
  });
});
