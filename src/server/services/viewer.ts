import { and, eq, lt, notExists, or, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { matches, swipes, users } from "@/server/db/schema";

export const VIEWER_DISPLAY_NAME = "You";
export const VIEWER_MAX_IDLE_DAYS = 14;

/** Seeded members who already liked a new viewer: 8, 9 or 10, per viewer. */
export function admirerCount(viewerId: string): number {
  return 8 + (Number.parseInt(viewerId.slice(0, 2), 16) % 3);
}

/**
 * Makes a handful of seeded members "already like" the viewer so matches can
 * happen in a demo. They are stored as plain swipe rows and are only ever
 * revealed through the normal mutual-match path.
 *
 * Deterministic per viewer (salted hash order) and idempotent, so concurrent
 * or repeated calls insert exactly the same rows.
 */
async function seedAdmirers(db: Db, viewerId: string): Promise<void> {
  await db.execute(sql`
    insert into swipes (swiper_id, target_id, action)
    select id, ${viewerId}::uuid, 'like'::swipe_action
    from users
    where kind = 'member'
    order by md5('admirer:' || ${viewerId}::text || id::text)
    limit ${admirerCount(viewerId)}
    on conflict do nothing
  `);
}

/**
 * Guarantees a demo viewer row (plus its admirers) exists for this id.
 * Returns false when the id belongs to a seeded member, so a forged cookie can
 * never be used to act as one.
 */
export async function ensureViewer(db: Db, viewerId: string): Promise<boolean> {
  const [existing] = await db
    .select({ kind: users.kind })
    .from(users)
    .where(eq(users.id, viewerId))
    .limit(1);
  if (existing) return existing.kind === "viewer";

  // One transaction: a concurrent first request blocks on the insert below
  // until this commits, so nobody can observe a viewer without its admirers.
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(users)
      .values({ id: viewerId, kind: "viewer", name: VIEWER_DISPLAY_NAME })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (inserted.length > 0) await seedAdmirers(tx, viewerId);
  });
  return true;
}

/** Wipes the viewer's swipes and matches and restores a fresh deck. */
export async function resetViewer(db: Db, viewerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Same per-visitor lock as recordSwipe: wait for in-flight swipes to finish.
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, viewerId))
      .for("update");
    await tx
      .delete(matches)
      .where(or(eq(matches.userA, viewerId), eq(matches.userB, viewerId)));
    await tx
      .delete(swipes)
      .where(or(eq(swipes.swiperId, viewerId), eq(swipes.targetId, viewerId)));
    await seedAdmirers(tx, viewerId);
  });
}

/**
 * Deletes demo viewers that are old and have not swiped recently. Cascades to
 * their swipes and matches. Returns how many viewers were removed.
 */
export async function cleanupIdleViewers(
  db: Db,
  { now = new Date(), maxIdleDays = VIEWER_MAX_IDLE_DAYS } = {},
): Promise<number> {
  const cutoff = new Date(now.getTime() - maxIdleDays * 86_400_000);
  const removed = await db
    .delete(users)
    .where(
      and(
        eq(users.kind, "viewer"),
        lt(users.createdAt, cutoff),
        notExists(
          db
            .select({ one: sql`1` })
            .from(swipes)
            .where(
              and(
                eq(swipes.swiperId, users.id),
                sql`${swipes.createdAt} > ${cutoff}`,
              ),
            ),
        ),
      ),
    )
    .returning({ id: users.id });
  return removed.length;
}
