import { readJson, viewerRoute } from "@/server/http";
import { recordSwipe } from "@/server/services/swipe";
import { swipeBodySchema } from "@/server/validation";

/** POST /swipe: records a like or pass and reports whether it created a match. */
export const POST = viewerRoute(async ({ db, viewerId, request }) => {
  const { profileId, action } = swipeBodySchema.parse(await readJson(request));
  return { body: await recordSwipe(db, viewerId, profileId, action) };
});
