/**
 * Wire types shared by the API and the UI. Nothing in here may describe who
 * has liked the viewer: the only relationship the API ever exposes is a
 * mutual match.
 */

export type SwipeAction = "like" | "pass";

/** The complete set of fields a client may ever receive about another person. */
export type PublicProfile = {
  id: string;
  name: string;
  age: number;
  photoUrl: string;
  bio: string;
  location: string;
  interests: string[];
};

export type MatchDto = {
  id: string;
  /** ISO-8601 timestamp of the moment both people had liked each other. */
  matchedAt: string;
  profile: PublicProfile;
};

export type FeedResponse = {
  profiles: PublicProfile[];
  hasMore: boolean;
};

/**
 * Identical shape for a pass, a one-sided like and any other non-match, so
 * the response can never be used to probe whether someone liked the viewer.
 */
export type SwipeResponse =
  { matched: false } | { matched: true; match: MatchDto };

export type MatchesResponse = {
  matches: MatchDto[];
};

export type ApiErrorBody = {
  error: { code: string; message: string };
};
