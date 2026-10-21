-- The foreign keys below are checked by the owner, which forced row level security would blind:
-- forced again at the end of this migration.
ALTER TABLE "contact" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interaction" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stage" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stage_change" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"interaction_id" uuid NOT NULL,
	"from_stage_id" uuid NOT NULL,
	"to_stage_id" uuid NOT NULL,
	"from_position" integer NOT NULL,
	"to_position" integer NOT NULL,
	CONSTRAINT "stage_change_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "stage_change_interaction_unique" UNIQUE("user_id","interaction_id"),
	CONSTRAINT "stage_change_change_check" CHECK ("stage_change"."from_stage_id" <> "stage_change"."to_stage_id"),
	CONSTRAINT "stage_change_position_check" CHECK ("stage_change"."from_position" >= 0 and "stage_change"."to_position" >= 0 and "stage_change"."from_position" <> "stage_change"."to_position")
);
--> statement-breakpoint
ALTER TABLE "gesture" DROP CONSTRAINT "gesture_kind_check";--> statement-breakpoint
ALTER TABLE "gesture" DROP CONSTRAINT "gesture_subject_check";--> statement-breakpoint
ALTER TABLE "interaction" DROP CONSTRAINT "interaction_kind_check";--> statement-breakpoint
ALTER TABLE "stage_change" ADD CONSTRAINT "stage_change_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_change" ADD CONSTRAINT "stage_change_contact_fk" FOREIGN KEY ("user_id","contact_id") REFERENCES "public"."contact"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_change" ADD CONSTRAINT "stage_change_interaction_fk" FOREIGN KEY ("user_id","interaction_id") REFERENCES "public"."interaction"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_change" ADD CONSTRAINT "stage_change_from_stage_fk" FOREIGN KEY ("user_id","from_stage_id") REFERENCES "public"."stage"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_change" ADD CONSTRAINT "stage_change_to_stage_fk" FOREIGN KEY ("user_id","to_stage_id") REFERENCES "public"."stage"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stage_change_contact_idx" ON "stage_change" USING btree ("user_id","contact_id");--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_kind_check" CHECK ("gesture"."kind" in ('contact_added', 'contact_edited', 'status_changed', 'stage_changed', 'follow_up_scheduled', 'follow_up_canceled', 'followed_up', 'interaction_noted', 'reply_recorded', 'positioning_used', 'trial_settled', 'positioning_created', 'positioning_edited', 'positioning_relabeled', 'positioning_archived', 'positioning_unarchived', 'positioning_deleted', 'positioning_attachment_added', 'positioning_attachment_removed', 'battle_opened'));--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_subject_check" CHECK (num_nonnulls("gesture"."contact_id", "gesture"."positioning_id", "gesture"."battle_id") = 1 and ("gesture"."contact_id" is not null) = ("gesture"."kind" in ('contact_added', 'contact_edited', 'status_changed', 'stage_changed', 'follow_up_scheduled', 'follow_up_canceled', 'followed_up', 'interaction_noted', 'reply_recorded', 'positioning_used', 'trial_settled')) and ("gesture"."positioning_id" is not null) = ("gesture"."kind" in ('positioning_created', 'positioning_edited', 'positioning_relabeled', 'positioning_archived', 'positioning_unarchived', 'positioning_deleted', 'positioning_attachment_added', 'positioning_attachment_removed')));--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_kind_check" CHECK ("interaction"."kind" in ('contact_added', 'status_changed', 'stage_changed', 'follow_up', 'call', 'meeting', 'message', 'other', 'reply', 'positioning_used'));--> statement-breakpoint
ALTER TABLE "contact" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interaction" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stage" FORCE ROW LEVEL SECURITY;
