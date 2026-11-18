import { and, eq } from "drizzle-orm";
import type { SwipeAction, SwipeResponse } from "@/lib/types";
import type { Db } from "@/server/db/client";
import { matches, swipes, users } from "@/server/db/schema";
import { toMatchDto } from "@/server/dto";
import { errors } from "@/server/errors";

/**
 * Records a swipe and reports whether it completed a mutual match.
 *
 * Privacy rules enforced here:
 * - A match exists only when BOTH sides liked. A pass can never match.
 * - The reciprocal lookup runs for every swipe, like or pass, so both paths do
 *   the same work and return the same `{ matched: false }` body.
 * - Swipes are final: a second swipe on the same profile is rejected, so the
 *   outcome can't be re-rolled to test who likes the viewer.
 */
export async function recordSwipe(
  db: Db,
  viewerId: string,
  profileId: string,
  action: SwipeAction,
): Promise<SwipeResponse> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, profileId), eq(users.kind, "member")))
      .limit(1);
    if (!target) throw errors.profileNotFound();

    const inserted = await tx
      .insert(swipes)
      .values({ swiperId: viewerId, targetId: profileId, action })
      .onConflictDoNothing()
      .returning({ targetId: swipes.targetId });
    if (inserted.length === 0) throw errors.alreadySwiped();

    const [theirLike] = await tx
      .select({ action: swipes.action })
      .from(swipes)
      .where(
        and(
          eq(swipes.swiperId, profileId),
          eq(swipes.targetId, viewerId),
          eq(swipes.action, "like"),
        ),
      )
      .limit(1);

    if (action !== "like" || !theirLike) return { matched: false };

    // Canonical pair order: one row per pair, whichever side completes it.
    const [userA, userB] =
      viewerId < profileId ? [viewerId, profileId] : [profileId, viewerId];
    const [created] = await tx
      .insert(matches)
      .values({ userA, userB })
      .onConflictDoNothing()
      .returning();
    const match =
      created ??
      (
        await tx
          .select()
          .from(matches)
          .where(and(eq(matches.userA, userA), eq(matches.userB, userB)))
          .limit(1)
      )[0];

    return { matched: true, match: toMatchDto(match, target) };
  });
}
