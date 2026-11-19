import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { getFeed } from "@/server/services/feed";
import { listMatches } from "@/server/services/matches";
import { recordSwipe } from "@/server/services/swipe";
import { ensureViewer } from "@/server/services/viewer";
import {
  admirersOf,
  createTestDb,
  memberIds,
  testBackend,
} from "../helpers/db";
import { assertInvariants } from "../helpers/invariants";

/** Small deterministic PRNG so any failure reproduces from its seed. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uuidFromSeed(rand: () => number): string {
  const hex = () => Math.floor(rand() * 16).toString(16);
  const chunk = (n: number) => Array.from({ length: n }, hex).join("");
  return `${chunk(8)}-${chunk(4)}-4${chunk(3)}-8${chunk(3)}-${chunk(12)}`;
}

const RUNS = testBackend === "postgres" ? 60 : 40;

describe(`randomized swipe sequences (${testBackend}, ${RUNS} runs)`, () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it("never breaks the matching rules, whatever the order or mix of swipes", async () => {
    const everyone = await memberIds(db);

    for (let seed = 1; seed <= RUNS; seed++) {
      const rand = mulberry32(seed);
      const viewer = uuidFromSeed(rand);
      await ensureViewer(db, viewer);
      const admirers = new Set(await admirersOf(db, viewer));

      // A random subset of members, in a random order, each liked or passed.
      const order = [...everyone]
        .sort(() => rand() - 0.5)
        .slice(0, Math.floor(rand() * (everyone.length + 1)));
      const liked = new Set<string>();
      const swiped = new Set<string>();
      const expectedMatches: string[] = [];

      for (const id of order) {
        const action = rand() < 0.5 ? "like" : "pass";
        const result = await recordSwipe(db, viewer, id, action);
        swiped.add(id);

        const shouldMatch = action === "like" && admirers.has(id);
        if (action === "like") liked.add(id);
        if (shouldMatch) expectedMatches.push(id);

        // The answer to every single swipe is exactly right.
        expect(result.matched, `seed ${seed}`).toBe(shouldMatch);
        if (!result.matched) expect(result).toEqual({ matched: false });
      }

      // A repeat swipe on anything already swiped is always refused.
      if (order.length) {
        const again = order[Math.floor(rand() * order.length)];
        await expect(
          recordSwipe(db, viewer, again, "like"),
        ).rejects.toMatchObject({
          code: "ALREADY_SWIPED",
        });
      }

      // Matches are exactly "admirers I liked", newest first.
      const listed = (await listMatches(db, viewer)).matches.map(
        (m) => m.profile.id,
      );
      expect(listed.slice().sort(), `seed ${seed}`).toEqual(
        expectedMatches.slice().sort(),
      );
      expect(listed, `seed ${seed}`).toEqual(expectedMatches.slice().reverse());

      // The deck is exactly the unswiped members: nothing repeats, nothing is lost.
      const deck: string[] = [];
      for (;;) {
        const page = await getFeed(db, viewer, 7);
        for (const profile of page.profiles) {
          deck.push(profile.id);
          await recordSwipe(db, viewer, profile.id, "pass");
        }
        if (!page.hasMore) break;
      }
      expect(new Set(deck).size, `seed ${seed}`).toBe(deck.length);
      for (const id of deck) expect(swiped.has(id), `seed ${seed}`).toBe(false);
      expect(deck.length + swiped.size, `seed ${seed}`).toBe(everyone.length);

      await assertInvariants(db, viewer);
    }
  });
});
