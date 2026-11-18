import { desc, eq, or, sql } from "drizzle-orm";
import type { MatchesResponse } from "@/lib/types";
import type { Db } from "@/server/db/client";
import { matches, users } from "@/server/db/schema";
import { toMatchDto } from "@/server/dto";

/** The viewer's mutual matches, newest first, each with the other person's public profile. */
export async function listMatches(
  db: Db,
  viewerId: string,
): Promise<MatchesResponse> {
  const rows = await db
    .select({ match: matches, other: users })
    .from(matches)
    .innerJoin(
      users,
      eq(
        users.id,
        sql`case when ${matches.userA} = ${viewerId} then ${matches.userB} else ${matches.userA} end`,
      ),
    )
    .where(or(eq(matches.userA, viewerId), eq(matches.userB, viewerId)))
    .orderBy(desc(matches.createdAt), desc(matches.id));

  return { matches: rows.map((row) => toMatchDto(row.match, row.other)) };
}
