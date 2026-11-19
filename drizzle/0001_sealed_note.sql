ALTER TABLE "swipes" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_note_only_on_like" CHECK ("swipes"."note" IS NULL OR "swipes"."action" = 'like');--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_note_max_length" CHECK (char_length("swipes"."note") <= 140);