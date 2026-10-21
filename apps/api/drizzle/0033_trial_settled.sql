-- The foreign key below is checked by the owner, which forced row level security would blind:
-- forced again at the end of this migration.
ALTER TABLE "trial" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trial_deviation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"trial_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "trial_deviation_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "trial_deviation_kind_check" CHECK ("trial_deviation"."kind" in ('off_cadence_follow_up', 'follow_up_moved'))
);
--> statement-breakpoint
ALTER TABLE "gesture" DROP CONSTRAINT "gesture_kind_check";--> statement-breakpoint
ALTER TABLE "gesture" DROP CONSTRAINT "gesture_subject_check";--> statement-breakpoint
ALTER TABLE "trial" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trial_deviation" ADD CONSTRAINT "trial_deviation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_deviation" ADD CONSTRAINT "trial_deviation_trial_fk" FOREIGN KEY ("user_id","trial_id") REFERENCES "public"."trial"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trial_deviation_trial_idx" ON "trial_deviation" USING btree ("user_id","trial_id");--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_kind_check" CHECK ("gesture"."kind" in ('contact_added', 'contact_edited', 'status_changed', 'follow_up_scheduled', 'follow_up_canceled', 'followed_up', 'interaction_noted', 'reply_recorded', 'positioning_used', 'trial_settled', 'positioning_created', 'positioning_edited', 'positioning_relabeled', 'positioning_archived', 'positioning_unarchived', 'positioning_deleted', 'positioning_attachment_added', 'positioning_attachment_removed', 'battle_opened'));--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_subject_check" CHECK (num_nonnulls("gesture"."contact_id", "gesture"."positioning_id", "gesture"."battle_id") = 1 and ("gesture"."contact_id" is not null) = ("gesture"."kind" in ('contact_added', 'contact_edited', 'status_changed', 'follow_up_scheduled', 'follow_up_canceled', 'followed_up', 'interaction_noted', 'reply_recorded', 'positioning_used', 'trial_settled')) and ("gesture"."positioning_id" is not null) = ("gesture"."kind" in ('positioning_created', 'positioning_edited', 'positioning_relabeled', 'positioning_archived', 'positioning_unarchived', 'positioning_deleted', 'positioning_attachment_added', 'positioning_attachment_removed')));--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "trial_settled_check" CHECK (("trial"."outcome" = 'in_progress') = ("trial"."settled_at" is null));--> statement-breakpoint
ALTER TABLE "trial" FORCE ROW LEVEL SECURITY;
