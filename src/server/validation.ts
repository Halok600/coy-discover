import { z } from "zod";
import { NOTE_MAX_LENGTH, noteLength } from "@/lib/note";

export { NOTE_MAX_LENGTH, noteLength };

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

/**
 * Cleans a sealed note: strips bidi overrides (which can disguise text) and
 * control characters, collapses whitespace to single spaces, and trims. An
 * empty result means "no note".
 */
export function normalizeNote(raw: string): string | null {
  const cleaned = raw
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

const noteSchema = z
  .string()
  .max(4 * NOTE_MAX_LENGTH, "Notes can be at most 140 characters.")
  .transform(normalizeNote)
  .refine(
    (note) => note === null || noteLength(note) <= NOTE_MAX_LENGTH,
    "Notes can be at most 140 characters.",
  );

export const swipeBodySchema = z
  .object({
    profileId: uuid,
    action: z.enum(["like", "pass"]),
    note: noteSchema.optional(),
  })
  .strict()
  .refine((body) => body.action === "like" || body.note === undefined, {
    message: "Only a like can carry a note.",
    path: ["note"],
  });

export const feedQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(FEED_MAX_LIMIT)
    .default(FEED_DEFAULT_LIMIT),
});

export type SwipeBody = z.infer<typeof swipeBodySchema>;
