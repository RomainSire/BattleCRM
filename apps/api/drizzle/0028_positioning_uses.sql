-- The foreign key below is checked by the owner, which forced row level security would blind:
-- forced again at the end of this migration.
ALTER TABLE "interaction" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "positioning" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gesture" DROP CONSTRAINT "gesture_kind_check";--> statement-breakpoint
ALTER TABLE "interaction" DROP CONSTRAINT "interaction_kind_check";--> statement-breakpoint
ALTER TABLE "follow_up" ADD COLUMN "rank" integer;--> statement-breakpoint
ALTER TABLE "interaction" ADD COLUMN "positioning_id" uuid;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_positioning_fk" FOREIGN KEY ("user_id","positioning_id") REFERENCES "public"."positioning"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interaction_positioning_idx" ON "interaction" USING btree ("user_id","positioning_id");--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_kind_check" CHECK ("gesture"."kind" in ('contact_added', 'contact_edited', 'status_changed', 'follow_up_scheduled', 'follow_up_canceled', 'followed_up', 'interaction_noted', 'reply_recorded', 'positioning_used', 'positioning_created', 'positioning_edited', 'positioning_relabeled', 'positioning_archived', 'positioning_unarchived', 'positioning_deleted', 'positioning_attachment_added', 'positioning_attachment_removed'));--> statement-breakpoint
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_rank_check" CHECK ("follow_up"."rank" > 0);--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_positioning_check" CHECK (("interaction"."kind" = 'positioning_used') = ("interaction"."positioning_id" is not null));--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_kind_check" CHECK ("interaction"."kind" in ('contact_added', 'status_changed', 'follow_up', 'call', 'meeting', 'message', 'other', 'reply', 'positioning_used'));;--> statement-breakpoint
ALTER TABLE "interaction" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "positioning" FORCE ROW LEVEL SECURITY;