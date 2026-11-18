import { and, eq, notExists, sql } from "drizzle-orm";
import type { FeedResponse } from "@/lib/types";
import type { Db } from "@/server/db/client";
import { swipes, users } from "@/server/db/schema";
import { toPublicProfile } from "@/server/dto";
import { FEED_DEFAULT_LIMIT } from "@/server/validation";

/**
 * Profiles the viewer has not swiped on yet.
 *
 * Privacy: the order is a hash of (viewer, profile) only. It is stable for a
 * given viewer but has nothing to do with who has liked them, so people who
 * liked the viewer are never front-loaded and the deck order reveals nothing.
 */
export async function getFeed(
  db: Db,
  viewerId: string,
  limit: number = FEED_DEFAULT_LIMIT,
): Promise<FeedResponse> {
  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.kind, "member"),
        notExists(
          db
            .select({ one: sql`1` })
            .from(swipes)
            .where(
              and(eq(swipes.swiperId, viewerId), eq(swipes.targetId, users.id)),
            ),
        ),
      ),
    )
    .orderBy(sql`md5(${viewerId}::text || ${users.id}::text)`, users.id)
    .limit(limit + 1); // one extra row tells us whether more remain

  return {
    profiles: rows.slice(0, limit).map(toPublicProfile),
    hasMore: rows.length > limit,
  };
}
