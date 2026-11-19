import { and, count, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { matches, swipes } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { SEED_PROFILES } from "@/server/seed/profiles";
import { getFeed } from "@/server/services/feed";
import { listMatches } from "@/server/services/matches";
import { recordSwipe } from "@/server/services/swipe";
import {
  admirerCount,
  ensureViewer,
  resetViewer,
} from "@/server/services/viewer";
import {
  NOTE_MAX_LENGTH,
  normalizeNote,
  noteLength,
} from "@/server/validation";
import {
  admirersOf,
  clearViewers,
  createTestDb,
  memberIds,
  newViewerId,
  nonAdmirerOf,
  testBackend,
} from "../helpers/db";

/** The note a seeded member sends with their like. */
function seededNote(id: string): string {
  return SEED_PROFILES[Number.parseInt(id.slice(-12), 16) - 1].note;
}

const ALL_SEEDED_NOTES = SEED_PROFILES.map((p) => p.note);

/** Every seeded note that appears somewhere in a payload. */
function leakedSeededNotes(payload: unknown): string[] {
  const text = JSON.stringify(payload);
  return ALL_SEEDED_NOTES.filter((note) =>
    text.includes(JSON.stringify(note).slice(1, -1)),
  );
}

async function storedNote(db: Db, from: string, to: string) {
  const [row] = await db
    .select({ note: swipes.note })
    .from(swipes)
    .where(and(eq(swipes.swiperId, from), eq(swipes.targetId, to)));
  return row?.note;
}

describe(`sealed notes (${testBackend})`, () => {
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

  describe("sending a note", () => {
    it("stores the note with a like", async () => {
      const stranger = await nonAdmirerOf(db, viewer);
      await recordSwipe(db, viewer, stranger, "like", "Coffee after the fest?");
      expect(await storedNote(db, viewer, stranger)).toBe(
        "Coffee after the fest?",
      );
    });

    it("cleans the note: trims, collapses whitespace, strips control characters", async () => {
      expect(normalizeNote("  hello \n\t  world  ")).toBe("hello world");
      expect(normalizeNote("a\u0000b\u0007c")).toBe("a b c");
      expect(normalizeNote("safe‮evil")).toBe("safeevil"); // bidi override removed
      expect(normalizeNote("   \n\t ")).toBeNull();
      expect(normalizeNote("")).toBeNull();

      const stranger = await nonAdmirerOf(db, viewer);
      await recordSwipe(db, viewer, stranger, "like", "  hi   there ‮ ");
      expect(await storedNote(db, viewer, stranger)).toBe("hi there");
    });

    it("treats a blank note as no note", async () => {
      const [admirer] = await admirersOf(db, viewer);
      const result = await recordSwipe(db, viewer, admirer, "like", "   \n ");
      expect(await storedNote(db, viewer, admirer)).toBeNull();
      expect(result.matched && result.match.yourNote).toBeNull();
    });

    it("accepts exactly 140 characters (emoji count as one) and refuses 141", async () => {
      const admirers = new Set(await admirersOf(db, viewer));
      const [first, other] = (await memberIds(db)).filter(
        (id) => !admirers.has(id),
      );
      const limit = "😀".repeat(NOTE_MAX_LENGTH);
      expect(noteLength(limit)).toBe(NOTE_MAX_LENGTH);
      await recordSwipe(db, viewer, first, "like", limit);
      expect(await storedNote(db, viewer, first)).toBe(limit);

      await expect(
        recordSwipe(
          db,
          viewer,
          other,
          "like",
          "😀".repeat(NOTE_MAX_LENGTH + 1),
        ),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
      // A refused swipe leaves nothing behind: the profile can still be swiped.
      expect(await storedNote(db, viewer, other)).toBeUndefined();
    });

    it("refuses a note on a pass and records nothing", async () => {
      const stranger = await nonAdmirerOf(db, viewer);
      await expect(
        recordSwipe(db, viewer, stranger, "pass", "psst"),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
      expect(await storedNote(db, viewer, stranger)).toBeUndefined();
      // Still swipeable afterwards.
      await expect(recordSwipe(db, viewer, stranger, "pass")).resolves.toEqual({
        matched: false,
      });
    });

    it("keeps the first note: a swipe can't be redone to change or add one", async () => {
      const stranger = await nonAdmirerOf(db, viewer);
      await recordSwipe(db, viewer, stranger, "like", "first");
      await expect(
        recordSwipe(db, viewer, stranger, "like", "second"),
      ).rejects.toMatchObject({ code: "ALREADY_SWIPED" });
      expect(await storedNote(db, viewer, stranger)).toBe("first");
    });

    it("stores only the winner's note when swipes race", async () => {
      const stranger = await nonAdmirerOf(db, viewer);
      const results = await Promise.allSettled(
        Array.from({ length: 12 }, (_, i) =>
          recordSwipe(db, viewer, stranger, "like", `note ${i}`),
        ),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const note = await storedNote(db, viewer, stranger);
      expect(note).toMatch(/^note \d+$/);
      const [row] = await db
        .select({ total: count() })
        .from(swipes)
        .where(and(eq(swipes.swiperId, viewer), eq(swipes.targetId, stranger)));
      expect(row.total).toBe(1);
    });
  });

  describe("what a non-match reveals (nothing)", () => {
    it("answers a like-with-note on a stranger exactly like a like without one", async () => {
      const ids = await memberIds(db);
      const admirers = new Set(await admirersOf(db, viewer));
      const [a, b] = ids.filter((id) => !admirers.has(id));

      const withNote = await recordSwipe(db, viewer, a, "like", "hello there");
      const without = await recordSwipe(db, viewer, b, "like");

      expect(JSON.stringify(withNote)).toBe(JSON.stringify(without));
      expect(withNote).toEqual({ matched: false });
    });

    it("never returns a note while there is no match", async () => {
      const admirers = await admirersOf(db, viewer);
      // Pass on every admirer: they all liked me, with notes, and I refused.
      for (const id of admirers) await recordSwipe(db, viewer, id, "pass");

      expect((await listMatches(db, viewer)).matches).toEqual([]);
      expect(leakedSeededNotes(await getFeed(db, viewer, 30))).toEqual([]);
    });
  });

  describe("what a match reveals (both notes, only here)", () => {
    it("returns both notes when the like completes a match", async () => {
      const [admirer] = await admirersOf(db, viewer);
      const result = await recordSwipe(
        db,
        viewer,
        admirer,
        "like",
        "Hi from me",
      );

      expect(result.matched).toBe(true);
      if (!result.matched) throw new Error("unreachable");
      expect(result.match.yourNote).toBe("Hi from me");
      expect(result.match.theirNote).toBe(seededNote(admirer));
    });

    it("returns null for my note when I sent none, and still their note", async () => {
      const [admirer] = await admirersOf(db, viewer);
      const result = await recordSwipe(db, viewer, admirer, "like");
      if (!result.matched) throw new Error("expected a match");
      expect(result.match.yourNote).toBeNull();
      expect(result.match.theirNote).toBe(seededNote(admirer));
    });

    it("lists the same notes in /matches, persistently", async () => {
      const [first, second] = await admirersOf(db, viewer);
      await recordSwipe(db, viewer, first, "like", "note to first");
      await recordSwipe(db, viewer, second, "like");

      const listed = (await listMatches(db, viewer)).matches;
      const byId = new Map(listed.map((m) => [m.profile.id, m]));
      expect(byId.get(first)).toMatchObject({
        yourNote: "note to first",
        theirNote: seededNote(first),
      });
      expect(byId.get(second)).toMatchObject({
        yourNote: null,
        theirNote: seededNote(second),
      });
    });

    it("only ever attaches a note to a mutual pair", async () => {
      const admirers = await admirersOf(db, viewer);
      const stranger = await nonAdmirerOf(db, viewer);
      await recordSwipe(db, viewer, admirers[0], "like", "mutual");
      await recordSwipe(db, viewer, admirers[1], "pass");
      await recordSwipe(db, viewer, stranger, "like", "one-sided");

      const listed = (await listMatches(db, viewer)).matches;
      expect(listed.map((m) => m.profile.id)).toEqual([admirers[0]]);
      const everything = JSON.stringify(listed);
      expect(everything).not.toContain("one-sided");
      expect(everything).not.toContain(seededNote(admirers[1]));
    });
  });

  describe("feed and isolation", () => {
    it("never puts any note in the feed", async () => {
      const page = await getFeed(db, viewer, 30);
      expect(leakedSeededNotes(page)).toEqual([]);
      for (const profile of page.profiles) {
        expect(Object.keys(profile)).not.toContain("note");
      }
    });

    it("never shows one visitor's notes to another", async () => {
      const other = newViewerId();
      await ensureViewer(db, other);
      const [mine] = await admirersOf(db, viewer);
      await recordSwipe(db, viewer, mine, "like", "only for my match");

      expect(JSON.stringify(await listMatches(db, other))).not.toContain(
        "only for my match",
      );
      expect(JSON.stringify(await getFeed(db, other, 30))).not.toContain(
        "only for my match",
      );
    });
  });

  describe("seeded admirers", () => {
    it("every admirer arrives with their own sealed note", async () => {
      const admirers = await admirersOf(db, viewer);
      expect(admirers).toHaveLength(admirerCount(viewer));
      for (const id of admirers) {
        expect(await storedNote(db, id, viewer)).toBe(seededNote(id));
      }
    });

    it("keeps notes short, clean and unique in the seed data", () => {
      const notes = SEED_PROFILES.map((p) => p.note);
      expect(new Set(notes).size).toBe(notes.length);
      for (const note of notes) {
        expect(noteLength(note)).toBeLessThanOrEqual(NOTE_MAX_LENGTH);
        expect(normalizeNote(note)).toBe(note);
      }
    });

    it("start over deletes my notes but restores the admirers' notes", async () => {
      const admirers = await admirersOf(db, viewer);
      await recordSwipe(db, viewer, admirers[0], "like", "will be wiped");
      await resetViewer(db, viewer);

      expect(await storedNote(db, viewer, admirers[0])).toBeUndefined();
      expect((await listMatches(db, viewer)).matches).toEqual([]);
      expect(await storedNote(db, admirers[0], viewer)).toBe(
        seededNote(admirers[0]),
      );
      // A fresh match after the restart carries the original admirer note.
      const again = await recordSwipe(db, viewer, admirers[0], "like", "fresh");
      if (!again.matched) throw new Error("expected a match");
      expect(again.match.theirNote).toBe(seededNote(admirers[0]));
      expect(again.match.yourNote).toBe("fresh");
    });
  });

  describe("database constraints (defense in depth)", () => {
    it("refuses a note on a pass even if the code were bypassed", async () => {
      const stranger = await nonAdmirerOf(db, viewer);
      await expect(
        db.insert(swipes).values({
          swiperId: viewer,
          targetId: stranger,
          action: "pass",
          note: "x",
        }),
      ).rejects.toThrow();
    });

    it("refuses a note over 140 characters even if the code were bypassed", async () => {
      const stranger = await nonAdmirerOf(db, viewer);
      await expect(
        db.insert(swipes).values({
          swiperId: viewer,
          targetId: stranger,
          action: "like",
          note: "x".repeat(141),
        }),
      ).rejects.toThrow();
    });

    it("never changes the matches table (notes live only on swipes)", async () => {
      const [admirer] = await admirersOf(db, viewer);
      await recordSwipe(db, viewer, admirer, "like", "note");
      const rows = await db.select().from(matches);
      expect(Object.keys(rows[0]).sort()).toEqual([
        "createdAt",
        "id",
        "userA",
        "userB",
      ]);
    });
  });

  it("throws AppError (not a crash) for every refused note", async () => {
    const stranger = await nonAdmirerOf(db, viewer);
    for (const attempt of [
      () => recordSwipe(db, viewer, stranger, "pass", "x"),
      () => recordSwipe(db, viewer, stranger, "like", "y".repeat(5000)),
    ]) {
      await expect(attempt()).rejects.toBeInstanceOf(AppError);
    }
  });
});
