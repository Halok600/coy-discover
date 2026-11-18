import { z } from "zod";

export const FEED_DEFAULT_LIMIT = 10;
export const FEED_MAX_LIMIT = 30;

const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Must be a UUID.",
  )
  .transform((value) => value.toLowerCase());

export const viewerIdSchema = uuid;

export const swipeBodySchema = z
  .object({
    profileId: uuid,
    action: z.enum(["like", "pass"]),
  })
  .strict();

export const feedQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(FEED_MAX_LIMIT)
    .default(FEED_DEFAULT_LIMIT),
});

export type SwipeBody = z.infer<typeof swipeBodySchema>;
