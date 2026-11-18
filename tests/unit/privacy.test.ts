import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { swipes } from "@/server/db/schema";
import { getFeed } from "@/server/services/feed";
import { listMatches } from "@/server/services/matches";
import { recordSwipe } from "@/server/services/swipe";
import { ensureViewer } from "@/server/services/viewer";
import {
  admirersOf,
  clearViewers,
  createTestDb,
  memberIds,
  newViewerId,
  nonAdmirerOf,
} from "../helpers/db";

const PUBLIC_PROFILE_KEYS = [
  "age",
  "bio",
  "id",
  "interests",
  "location",
  "name",
  "photoUrl",
];

/**
 * Coy's core promise: nobody learns who has liked them unless it is mutual.
 * Each test below is one way a naive build would leak that, expressed as an
 * assertion.
 */
describe("privacy: never reveal who liked the viewer unless it is mutual", () => {
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

  describe("payload shape", () => {
    it("exposes only the public profile fields in the feed", async () => {
      const { profiles } = await getFeed(db, viewer, 30);
      expect(profiles.length).toBeGreaterThan(0);
      for (const profile of profiles) {
        expect(Object.keys(profile).sort()).toEqual(PUBLIC_PROFILE_KEYS);
      }
    });

    it("exposes only the public profile fields in matches", async () => {
      const [admirer] = await admirersOf(db, viewer);
      const swipe = await recordSwipe(db, viewer, admirer, "like");
      const { matches } = await listMatches(db, viewer);

      for (const match of matches) {
        expect(Object.keys(match).sort()).toEqual([
          "id",
          "matchedAt",
          "profile",
        ]);
        expect(Object.keys(match.profile).sort()).toEqual(PUBLIC_PROFILE_KEYS);
      }
      if (swipe.matched) {
        expect(Object.keys(swipe.match.profile).sort()).toEqual(
          PUBLIC_PROFILE_KEYS,
        );
      }
    });
  });

  describe("swipe responses", () => {
    it("answers a pass on an admirer exactly like a pass on a stranger", async () => {
      const [admirer] = await admirersOf(db, viewer);
      const stranger = await nonAdmirerOf(db, viewer);

      const onAdmirer = await recordSwipe(db, viewer, admirer, "pass");
      const onStranger = await recordSwipe(db, viewer, stranger, "pass");

      expect(JSON.stringify(onAdmirer)).toBe(JSON.stringify(onStranger));
      expect(onAdmirer).toEqual({ matched: false });
    });

    it("never reveals a one-sided like, only a mutual one", async () => {
      const stranger = await nonAdmirerOf(db, viewer);
      const result = await recordSwipe(db, viewer, stranger, "like");
      expect(result).toEqual({ matched: false });
    });

    it("does not let a viewer re-roll a swipe to probe for admirers", async () => {
      const [admirer] = await admirersOf(db, viewer);
      await recordSwipe(db, viewer, admirer, "pass");
      // The only way to find out "did they like me?" would be to swipe again.
      await expect(recordSwipe(db, viewer, admirer, "like")).rejects.toThrow();
      expect((await listMatches(db, viewer)).matches).toHaveLength(0);
    });
  });

  describe("ordering", () => {
    const md5 = (text: string) => createHash("md5").update(text).digest("hex");

    it("orders the deck by a hash of viewer and profile, nothing else", async () => {
      const expected = (await memberIds(db))
        .sort((a, b) => {
          const [ha, hb] = [md5(viewer + a), md5(viewer + b)];
          return ha < hb ? -1 : ha > hb ? 1 : 0;
        })
        .slice(0, 30);

      const { profiles } = await getFeed(db, viewer, 30);
      expect(profiles.map((p) => p.id)).toEqual(expected);
    });

    it("gives the same deck whether or not anyone liked the viewer", async () => {
      const withAdmirers = await getFeed(db, viewer, 30);

      await db
        .delete(swipes)
        .where(and(eq(swipes.targetId, viewer), eq(swipes.action, "like")));
      expect(await admirersOf(db, viewer)).toHaveLength(0);

      expect(await getFeed(db, viewer, 30)).toEqual(withAdmirers);
    });
  });

  describe("matches", () => {
    it("contains only mutual likes, never passes or one-sided likes", async () => {
      const admirers = await admirersOf(db, viewer);
      const stranger = await nonAdmirerOf(db, viewer);
      await recordSwipe(db, viewer, admirers[0], "like"); // mutual
      await recordSwipe(db, viewer, admirers[1], "pass"); // they liked, I passed
      await recordSwipe(db, viewer, stranger, "like"); // I liked, they did not

      const ids = (await listMatches(db, viewer)).matches.map(
        (m) => m.profile.id,
      );
      expect(ids).toEqual([admirers[0]]);
    });

    it("starts empty: admirers are invisible until the viewer likes them back", async () => {
      expect((await listMatches(db, viewer)).matches).toEqual([]);
    });
  });

  describe("isolation between visitors", () => {
    it("never shows one visitor's matches to another", async () => {
      const other = newViewerId();
      await ensureViewer(db, other);
      const [theirAdmirer] = await admirersOf(db, other);
      await recordSwipe(db, other, theirAdmirer, "like");

      expect((await listMatches(db, other)).matches).toHaveLength(1);
      expect((await listMatches(db, viewer)).matches).toHaveLength(0);
    });

    it("does not let one visitor liking a member create a match for another", async () => {
      const other = newViewerId();
      await ensureViewer(db, other);
      const [shared] = await admirersOf(db, viewer);
      await recordSwipe(db, other, shared, "like");
      expect((await listMatches(db, viewer)).matches).toHaveLength(0);
    });
  });
});
