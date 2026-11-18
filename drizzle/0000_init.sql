CREATE TYPE "public"."swipe_action" AS ENUM('like', 'pass');--> statement-breakpoint
CREATE TYPE "public"."user_kind" AS ENUM('member', 'viewer');--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a" uuid NOT NULL,
	"user_b" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_pair_unique" UNIQUE("user_a","user_b"),
	CONSTRAINT "matches_canonical_order" CHECK ("matches"."user_a" < "matches"."user_b")
);
--> statement-breakpoint
CREATE TABLE "swipes" (
	"swiper_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"action" "swipe_action" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swipes_swiper_id_target_id_pk" PRIMARY KEY("swiper_id","target_id"),
	CONSTRAINT "swipes_no_self_swipe" CHECK ("swipes"."swiper_id" <> "swipes"."target_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "user_kind" NOT NULL,
	"name" text NOT NULL,
	"age" integer,
	"photo_url" text,
	"bio" text,
	"location" text,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_member_profile_complete" CHECK ("users"."kind" <> 'member' OR ("users"."age" IS NOT NULL AND "users"."photo_url" IS NOT NULL AND "users"."bio" IS NOT NULL AND "users"."location" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_a_users_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_b_users_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_swiper_id_users_id_fk" FOREIGN KEY ("swiper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_user_b_idx" ON "matches" USING btree ("user_b");--> statement-breakpoint
CREATE INDEX "swipes_target_idx" ON "swipes" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "users_kind_idx" ON "users" USING btree ("kind");