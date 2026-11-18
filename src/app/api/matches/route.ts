import { viewerRoute } from "@/server/http";
import { listMatches } from "@/server/services/matches";

/** GET /matches: the viewer's mutual matches. */
export const GET = viewerRoute(async ({ db, viewerId }) => ({
  body: await listMatches(db, viewerId),
}));
