import { viewerRoute } from "@/server/http";
import { resetViewer } from "@/server/services/viewer";

/** POST /api/demo/reset: gives the current visitor a fresh deck ("Start over"). */
export const POST = viewerRoute(async ({ db, viewerId }) => {
  await resetViewer(db, viewerId);
  return { body: { ok: true } };
});
