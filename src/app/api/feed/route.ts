import { viewerRoute } from "@/server/http";
import { getFeed } from "@/server/services/feed";
import { feedQuerySchema } from "@/server/validation";

/** GET /feed: profiles the viewer has not swiped on yet. */
export const GET = viewerRoute(async ({ db, viewerId, request }) => {
  const { limit } = feedQuerySchema.parse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  return { body: await getFeed(db, viewerId, limit) };
});
