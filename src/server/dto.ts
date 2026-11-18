import type { MatchDto, PublicProfile } from "@/lib/types";
import type { UserRow } from "@/server/db/schema";

/**
 * The only place a database row becomes something a client can see. It builds
 * the object field by field, so a column added to `users` later can never leak
 * by accident.
 */
export function toPublicProfile(row: UserRow): PublicProfile {
  if (
    row.age === null ||
    row.photoUrl === null ||
    row.bio === null ||
    row.location === null
  ) {
    // Guaranteed by the users_member_profile_complete CHECK constraint.
    throw new Error(`User ${row.id} has an incomplete profile.`);
  }
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    photoUrl: row.photoUrl,
    bio: row.bio,
    location: row.location,
    interests: [...row.interests],
  };
}

export function toMatchDto(
  match: { id: string; createdAt: Date },
  profile: UserRow,
): MatchDto {
  return {
    id: match.id,
    matchedAt: match.createdAt.toISOString(),
    profile: toPublicProfile(profile),
  };
}
