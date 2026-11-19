import { and, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { MatchesResponse } from "@/lib/types";
import type { Db } from "@/server/db/client";
import { matches, swipes, users } from "@/server/db/schema";
import { toMatchDto } from "@/server/dto";

const theirLike = alias(swipes, "their_like");
const yourLike = alias(swipes, "your_like");

/**
 * The viewer's mutual matches, newest first, each with the other person's
 * public profile and both sealed notes. Notes are read only through a match
 * row, which exists only for a mutual like.
 */
export async function listMatches(
  db: Db,
  viewerId: string,
): Promise<MatchesResponse> {
  const rows = await db
    .select({
      match: matches,
      other: users,
      theirNote: theirLike.note,
      yourNote: yourLike.note,
    })
    .from(matches)
    .innerJoin(
      users,
      eq(
        users.id,
        sql`case when ${matches.userA} = ${viewerId} then ${matches.userB} else ${matches.userA} end`,
      ),
    )
    .leftJoin(
      theirLike,
      and(eq(theirLike.swiperId, users.id), eq(theirLike.targetId, viewerId)),
    )
    .leftJoin(
      yourLike,
      and(eq(yourLike.swiperId, viewerId), eq(yourLike.targetId, users.id)),
    )
    .where(or(eq(matches.userA, viewerId), eq(matches.userB, viewerId)))
    .orderBy(desc(matches.createdAt), desc(matches.id));

  return {
    matches: rows.map((row) =>
      toMatchDto(row.match, row.other, {
        theirNote: row.theirNote,
        yourNote: row.yourNote,
      }),
    ),
  };
}
