import { and, eq } from "drizzle-orm";
import type { SwipeAction, SwipeResponse } from "@/lib/types";
import type { Db } from "@/server/db/client";
import { matches, swipes, users } from "@/server/db/schema";
import { toMatchDto } from "@/server/dto";
import { AppError, errors } from "@/server/errors";
import {
  NOTE_MAX_LENGTH,
  normalizeNote,
  noteLength,
} from "@/server/validation";

/**
 * Records a swipe and reports whether it completed a mutual match.
 *
 * Privacy rules enforced here:
 * - A match exists only when BOTH sides liked. A pass can never match.
 * - The reciprocal lookup runs for every swipe, like or pass, so both paths do
 *   the same work and return the same `{ matched: false }` body.
 * - Swipes are final: a second swipe on the same profile is rejected, so the
 *   outcome can't be re-rolled to test who likes the viewer.
 * - Sealed notes: only a like can carry one, and notes are returned only
 *   inside a match. A non-match answer is `{ matched: false }` with or without
 *   a note, so sending one reveals nothing either.
 */
export async function recordSwipe(
  db: Db,
  viewerId: string,
  profileId: string,
  action: SwipeAction,
  note: string | null = null,
): Promise<SwipeResponse> {
  // The same rules as the API's validation, enforced here too.
  if (note !== null && action !== "like") {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      "Only a like can carry a note.",
    );
  }
  const cleanNote = note === null ? null : normalizeNote(note);
  if (cleanNote !== null && noteLength(cleanNote) > NOTE_MAX_LENGTH) {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      `Notes can be at most ${NOTE_MAX_LENGTH} characters.`,
    );
  }

  return db.transaction(async (tx) => {
    // Serialize this visitor's swipes with each other and with "Start over",
    // so a reset can never run between a swipe and the match it creates.
    const [self] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, viewerId))
      .for("update");
    if (!self) throw errors.unauthorized();

    const [target] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, profileId), eq(users.kind, "member")))
      .limit(1);
    if (!target) throw errors.profileNotFound();

    const inserted = await tx
      .insert(swipes)
      .values({
        swiperId: viewerId,
        targetId: profileId,
        action,
        note: cleanNote,
      })
      .onConflictDoNothing()
      .returning({ targetId: swipes.targetId });
    if (inserted.length === 0) throw errors.alreadySwiped();

    const [theirLike] = await tx
      .select({ action: swipes.action, note: swipes.note })
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

    return {
      matched: true,
      match: toMatchDto(match, target, {
        theirNote: theirLike.note,
        yourNote: cleanNote,
      }),
    };
  });
}
