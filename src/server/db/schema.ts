import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** `member` rows are the seeded, swipeable profiles; `viewer` rows are demo visitors. */
export const userKind = pgEnum("user_kind", ["member", "viewer"]);
export const swipeAction = pgEnum("swipe_action", ["like", "pass"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: userKind("kind").notNull(),
    name: text("name").notNull(),
    age: integer("age"),
    photoUrl: text("photo_url"),
    bio: text("bio"),
    location: text("location"),
    interests: text("interests")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Every swipeable profile must be fully filled in; viewers need only a name.
    check(
      "users_member_profile_complete",
      sql`${t.kind} <> 'member' OR (${t.age} IS NOT NULL AND ${t.photoUrl} IS NOT NULL AND ${t.bio} IS NOT NULL AND ${t.location} IS NOT NULL)`,
    ),
    index("users_kind_idx").on(t.kind),
  ],
);

/**
 * One row per (swiper, target). The composite primary key makes swipes final:
 * a second swipe on the same profile can never overwrite the first.
 */
export const swipes = pgTable(
  "swipes",
  {
    swiperId: uuid("swiper_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: swipeAction("action").notNull(),
    /**
     * A "sealed note": optional text sent with a like. It is only ever read
     * back inside a mutual match, so a one-sided note stays unreadable.
     */
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.swiperId, t.targetId] }),
    check("swipes_no_self_swipe", sql`${t.swiperId} <> ${t.targetId}`),
    // Defense in depth: the API already refuses both of these.
    check(
      "swipes_note_only_on_like",
      sql`${t.note} IS NULL OR ${t.action} = 'like'`,
    ),
    check("swipes_note_max_length", sql`char_length(${t.note}) <= 140`),
    index("swipes_target_idx").on(t.targetId),
  ],
);

/**
 * A mutual match. The pair is stored in canonical order (userA < userB) so a
 * match can only exist once, whichever side completed it.
 */
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userA: uuid("user_a")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userB: uuid("user_b")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("matches_pair_unique").on(t.userA, t.userB),
    check("matches_canonical_order", sql`${t.userA} < ${t.userB}`),
    index("matches_user_b_idx").on(t.userB),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SwipeRow = typeof swipes.$inferSelect;
export type MatchRow = typeof matches.$inferSelect;
