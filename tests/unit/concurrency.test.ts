import { count, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { matches, swipes, users } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { getFeed } from "@/server/services/feed";
import { listMatches } from "@/server/services/matches";
import { recordSwipe } from "@/server/services/swipe";
import {
  admirerCount,
  ensureViewer,
  resetViewer,
} from "@/server/services/viewer";
import {
  admirersOf,
  clearViewers,
  createTestDb,
  memberIds,
  newViewerId,
  nonAdmirerOf,
  testBackend,
} from "../helpers/db";
import { assertInvariants } from "../helpers/invariants";

/** Runs all tasks at once and reports how each one ended. */
async function race<T>(tasks: (() => Promise<T>)[]) {
  const settled = await Promise.allSettled(tasks.map((task) => task()));
  return {
    ok: settled.filter(
      (r) => r.status === "fulfilled",
    ) as PromiseFulfilledResult<T>[],
    failed: settled.filter(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult[],
  };
}

describe(`concurrency (${testBackend})`, () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });
  beforeEach(async () => {
    await clearViewers(db);
  });

  it("lets exactly one of many simultaneous swipes on the same profile through", async () => {
    const viewer = newViewerId();
    await ensureViewer(db, viewer);
    const target = await nonAdmirerOf(db, viewer);

    const { ok, failed } = await race(
      Array.from(
        { length: 25 },
        (_, i) => () =>
          recordSwipe(db, viewer, target, i % 2 ? "like" : "pass"),
      ),
    );

    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(24);
    for (const failure of failed) {
      expect(failure.reason).toBeInstanceOf(AppError);
      expect(failure.reason).toMatchObject({ code: "ALREADY_SWIPED" });
    }
    const [row] = await db
      .select({ total: count() })
      .from(swipes)
      .where(eq(swipes.swiperId, viewer));
    expect(row.total).toBe(1);
  });

  it("creates exactly one match when the same mutual like is sent many times at once", async () => {
    const viewer = newViewerId();
    await ensureViewer(db, viewer);
    const [admirer] = await admirersOf(db, viewer);

    const { ok } = await race(
      Array.from(
        { length: 20 },
        () => () => recordSwipe(db, viewer, admirer, "like"),
      ),
    );

    expect(ok).toHaveLength(1);
    expect(ok[0].value).toMatchObject({ matched: true });
    const [row] = await db.select({ total: count() }).from(matches);
    expect(row.total).toBe(1);
    await assertInvariants(db, viewer);
  });

  it("matches exactly the admirers when every profile is liked in parallel", async () => {
    const viewer = newViewerId();
    await ensureViewer(db, viewer);
    const everyone = await memberIds(db);

    const { ok, failed } = await race(
      everyone.map((id) => () => recordSwipe(db, viewer, id, "like")),
    );

    expect(failed).toHaveLength(0);
    const matched = ok.filter((r) => r.value.matched);
    expect(matched).toHaveLength(admirerCount(viewer));
    expect((await listMatches(db, viewer)).matches).toHaveLength(
      admirerCount(viewer),
    );
    await assertInvariants(db, viewer);
  });

  it("serves a viewer the correct deck while they are swiping from several tabs at once", async () => {
    const viewer = newViewerId();
    await ensureViewer(db, viewer);
    const everyone = await memberIds(db);

    // Three "tabs" each swipe the whole deck in their own order, plus feed reads.
    const orders = [
      everyone,
      [...everyone].reverse(),
      [...everyone].sort(() => 0.5 - Math.random()),
    ];
    const { failed } = await race<unknown>([
      ...orders.flatMap((order) =>
        order.map((id) => () => recordSwipe(db, viewer, id, "pass")),
      ),
      ...Array.from({ length: 20 }, () => () => getFeed(db, viewer, 30)),
    ]);

    // The only acceptable failure is losing the race to another tab.
    for (const failure of failed) {
      expect(failure.reason).toMatchObject({ code: "ALREADY_SWIPED" });
    }
    expect(await getFeed(db, viewer, 30)).toEqual({
      profiles: [],
      hasMore: false,
    });
    await assertInvariants(db, viewer);
  });

  it("creates many viewers at once without mixing up their admirers", async () => {
    const ids = Array.from({ length: 30 }, newViewerId);
    await Promise.all(ids.map((id) => ensureViewer(db, id)));

    for (const id of ids) {
      expect(await admirersOf(db, id)).toHaveLength(admirerCount(id));
    }
    const [row] = await db
      .select({ total: count() })
      .from(users)
      .where(eq(users.kind, "viewer"));
    expect(row.total).toBe(ids.length);
  });

  it("keeps independent viewers independent while they swipe the same members simultaneously", async () => {
    const a = newViewerId();
    const b = newViewerId();
    await Promise.all([ensureViewer(db, a), ensureViewer(db, b)]);
    const everyone = await memberIds(db);

    const { failed } = await race<unknown>([
      ...everyone.map((id) => () => recordSwipe(db, a, id, "like")),
      ...everyone.map((id) => () => recordSwipe(db, b, id, "pass")),
    ]);

    expect(failed).toHaveLength(0);
    expect((await listMatches(db, a)).matches).toHaveLength(admirerCount(a));
    expect((await listMatches(db, b)).matches).toHaveLength(0);
    await assertInvariants(db, a);
    await assertInvariants(db, b);
  });

  it("stays consistent when a reset lands in the middle of swiping", async () => {
    // The interleaving is narrow, so try it many times with fresh viewers.
    for (let attempt = 0; attempt < 15; attempt++) {
      const viewer = newViewerId();
      await ensureViewer(db, viewer);
      const everyone = await memberIds(db);

      const { failed } = await race<unknown>([
        ...everyone.map((id) => () => recordSwipe(db, viewer, id, "like")),
        () => resetViewer(db, viewer),
        () => resetViewer(db, viewer),
      ]);

      // A swipe may lose to a reset or to a repeat, but must never corrupt data
      // or surface an unexpected error.
      for (const failure of failed) {
        expect(failure.reason).toBeInstanceOf(AppError);
      }
      await assertInvariants(db, viewer);
    }
  });
});
