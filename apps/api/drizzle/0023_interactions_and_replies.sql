ALTER TABLE "gesture" DROP CONSTRAINT "gesture_kind_check";--> statement-breakpoint
ALTER TABLE "interaction" DROP CONSTRAINT "interaction_kind_check";--> statement-breakpoint
ALTER TABLE "interaction" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_kind_check" CHECK ("gesture"."kind" in ('contact_added', 'contact_edited', 'status_changed', 'follow_up_scheduled', 'follow_up_canceled', 'followed_up', 'interaction_noted', 'reply_recorded'));--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_channel_check" CHECK ("interaction"."channel" in ('email', 'linkedin', 'phone', 'mail'));--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_reply_channel_check" CHECK (("interaction"."kind" = 'reply') = ("interaction"."channel" is not null));--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_kind_check" CHECK ("interaction"."kind" in ('contact_added', 'status_changed', 'follow_up', 'call', 'meeting', 'message', 'other', 'reply'));