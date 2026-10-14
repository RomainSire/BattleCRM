ALTER TABLE "gesture" DROP CONSTRAINT "gesture_kind_check";--> statement-breakpoint
ALTER TABLE "interaction" DROP CONSTRAINT "interaction_kind_check";--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_kind_check" CHECK ("gesture"."kind" in ('contact_added', 'contact_edited', 'status_changed'));--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_kind_check" CHECK ("interaction"."kind" in ('contact_added', 'status_changed'));