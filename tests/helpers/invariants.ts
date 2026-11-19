import { and, eq, or } from "drizzle-orm";
import { expect } from "vitest";
import type { Db } from "@/server/db/client";
import { matches, swipes } from "@/server/db/schema";
import { admirersOf } from "./db";

/**
 * Rules that must hold for a viewer after ANY sequence of operations:
 *  - every match is backed by a like in BOTH directions (never one-sided),
 *  - a match exists only with someone who liked the viewer first,
 *  - there is at most one match per pair, in canonical order,
 *  - the viewer's set of matches is exactly: admirers they liked.
 */
export async function assertInvariants(db: Db, viewerId: string) {
  const rows = await db
    .select()
    .from(matches)
    .where(or(eq(matches.userA, viewerId), eq(matches.userB, viewerId)));

  const admirers = new Set(await admirersOf(db, viewerId));
  const liked = new Set(
    (
      await db
        .select({ id: swipes.targetId })
        .from(swipes)
        .where(and(eq(swipes.swiperId, viewerId), eq(swipes.action, "like")))
    ).map((row) => row.id),
  );

  const matchedWith: string[] = [];
  for (const row of rows) {
    expect(row.userA < row.userB).toBe(true);
    const other = row.userA === viewerId ? row.userB : row.userA;
    matchedWith.push(other);
    expect(admirers.has(other)).toBe(true); // they liked first
    expect(liked.has(other)).toBe(true); // and so did the viewer
  }
  expect(new Set(matchedWith).size).toBe(matchedWith.length); // no duplicates

  const expected = [...liked].filter((id) => admirers.has(id)).sort();
  expect(matchedWith.sort()).toEqual(expected);
}
