-- The foreign keys below are checked by the owner, which forced row level security would blind:
-- forced again at the end of this migration.
ALTER TABLE "contact" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interaction" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "follow_up" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" text NOT NULL,
	"due_on" date NOT NULL,
	"note" text,
	"interaction_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	CONSTRAINT "follow_up_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "follow_up_status_check" CHECK ("follow_up"."status" in ('scheduled', 'done', 'canceled')),
	CONSTRAINT "follow_up_done_check" CHECK (("follow_up"."status" = 'done') = ("follow_up"."interaction_id" is not null)),
	CONSTRAINT "follow_up_note_check" CHECK ("follow_up"."note" <> '')
);
--> statement-breakpoint
ALTER TABLE "gesture" DROP CONSTRAINT "gesture_kind_check";--> statement-breakpoint
ALTER TABLE "interaction" DROP CONSTRAINT "interaction_kind_check";--> statement-breakpoint
ALTER TABLE "interaction" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_contact_fk" FOREIGN KEY ("user_id","contact_id") REFERENCES "public"."contact"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_interaction_fk" FOREIGN KEY ("user_id","interaction_id") REFERENCES "public"."interaction"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "follow_up_scheduled_unique" ON "follow_up" USING btree ("user_id","contact_id") WHERE "follow_up"."status" = 'scheduled';--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_kind_check" CHECK ("gesture"."kind" in ('contact_added', 'contact_edited', 'status_changed', 'follow_up_scheduled', 'follow_up_canceled', 'followed_up'));--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_note_check" CHECK ("interaction"."note" <> '');--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_kind_check" CHECK ("interaction"."kind" in ('contact_added', 'status_changed', 'follow_up'));;--> statement-breakpoint
ALTER TABLE "contact" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interaction" FORCE ROW LEVEL SECURITY;