-- The foreign keys below are checked by the owner, which forced row level security would blind:
-- forced again at the end of this migration.
ALTER TABLE "stage" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "positioning" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"label" text NOT NULL,
	"channel" text NOT NULL,
	"content" text,
	"follow_up_days" integer[] NOT NULL,
	"follow_up_messages" text[] NOT NULL,
	"response_window_days" integer NOT NULL,
	"derived_from_id" uuid,
	"archived_at" timestamp with time zone,
	CONSTRAINT "positioning_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "positioning_label_check" CHECK ("positioning"."label" <> ''),
	CONSTRAINT "positioning_content_check" CHECK ("positioning"."content" <> ''),
	CONSTRAINT "positioning_channel_check" CHECK ("positioning"."channel" in ('email', 'linkedin', 'phone', 'mail')),
	CONSTRAINT "positioning_follow_ups_check" CHECK (cardinality("positioning"."follow_up_days") = cardinality("positioning"."follow_up_messages") and 0 < all("positioning"."follow_up_days") and '' <> all("positioning"."follow_up_messages")),
	CONSTRAINT "positioning_response_window_days_check" CHECK ("positioning"."response_window_days" > 0)
);
--> statement-breakpoint
ALTER TABLE "gesture" DROP CONSTRAINT "gesture_kind_check";--> statement-breakpoint
ALTER TABLE "gesture" ALTER COLUMN "contact_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "gesture" ADD COLUMN "positioning_id" uuid;--> statement-breakpoint
ALTER TABLE "positioning" ADD CONSTRAINT "positioning_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positioning" ADD CONSTRAINT "positioning_stage_fk" FOREIGN KEY ("user_id","stage_id") REFERENCES "public"."stage"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positioning" ADD CONSTRAINT "positioning_derived_from_fk" FOREIGN KEY ("user_id","derived_from_id") REFERENCES "public"."positioning"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "positioning_stage_idx" ON "positioning" USING btree ("user_id","stage_id");--> statement-breakpoint
CREATE INDEX "gesture_positioning_idx" ON "gesture" USING btree ("user_id","positioning_id");--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_subject_check" CHECK (("gesture"."contact_id" is null) = ("gesture"."kind" in ('positioning_created', 'positioning_edited', 'positioning_relabeled', 'positioning_archived', 'positioning_unarchived', 'positioning_deleted')) and ("gesture"."positioning_id" is null) <> ("gesture"."contact_id" is null));--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_kind_check" CHECK ("gesture"."kind" in ('contact_added', 'contact_edited', 'status_changed', 'follow_up_scheduled', 'follow_up_canceled', 'followed_up', 'interaction_noted', 'reply_recorded', 'positioning_created', 'positioning_edited', 'positioning_relabeled', 'positioning_archived', 'positioning_unarchived', 'positioning_deleted'));--> statement-breakpoint
ALTER TABLE "stage" FORCE ROW LEVEL SECURITY;