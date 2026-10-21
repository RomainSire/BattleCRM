-- The foreign keys below are checked by the owner, which forced row level security would blind:
-- forced again at the end of this migration.
ALTER TABLE "stage" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "positioning" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "battle" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"champion_id" uuid NOT NULL,
	"challenger_id" uuid NOT NULL,
	"success_criterion" text NOT NULL,
	"target" text,
	"threshold" double precision NOT NULL,
	"horizon" integer NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"opened_on" date NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "battle_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "battle_opponents_check" CHECK ("battle"."champion_id" <> "battle"."challenger_id"),
	CONSTRAINT "battle_success_criterion_check" CHECK ("battle"."success_criterion" <> ''),
	CONSTRAINT "battle_target_check" CHECK ("battle"."target" in ('consultancy', 'end_client', 'unknown')),
	CONSTRAINT "battle_threshold_check" CHECK ("battle"."threshold" in (0.8, 0.85, 0.9, 0.95)),
	CONSTRAINT "battle_horizon_check" CHECK ("battle"."horizon" between 10 and 100)
);
--> statement-breakpoint
ALTER TABLE "gesture" DROP CONSTRAINT "gesture_kind_check";--> statement-breakpoint
ALTER TABLE "gesture" DROP CONSTRAINT "gesture_subject_check";--> statement-breakpoint
ALTER TABLE "gesture" ADD COLUMN "battle_id" uuid;--> statement-breakpoint
ALTER TABLE "battle" ADD CONSTRAINT "battle_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle" ADD CONSTRAINT "battle_stage_fk" FOREIGN KEY ("user_id","stage_id") REFERENCES "public"."stage"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle" ADD CONSTRAINT "battle_champion_fk" FOREIGN KEY ("user_id","champion_id") REFERENCES "public"."positioning"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle" ADD CONSTRAINT "battle_challenger_fk" FOREIGN KEY ("user_id","challenger_id") REFERENCES "public"."positioning"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "battle_open_per_stage_unique" ON "battle" USING btree ("user_id","stage_id") WHERE "battle"."closed_at" is null;--> statement-breakpoint
CREATE INDEX "battle_stage_idx" ON "battle" USING btree ("user_id","stage_id");--> statement-breakpoint
CREATE INDEX "battle_champion_idx" ON "battle" USING btree ("user_id","champion_id");--> statement-breakpoint
CREATE INDEX "battle_challenger_idx" ON "battle" USING btree ("user_id","challenger_id");--> statement-breakpoint
CREATE INDEX "gesture_battle_idx" ON "gesture" USING btree ("user_id","battle_id");--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_kind_check" CHECK ("gesture"."kind" in ('contact_added', 'contact_edited', 'status_changed', 'follow_up_scheduled', 'follow_up_canceled', 'followed_up', 'interaction_noted', 'reply_recorded', 'positioning_used', 'positioning_created', 'positioning_edited', 'positioning_relabeled', 'positioning_archived', 'positioning_unarchived', 'positioning_deleted', 'positioning_attachment_added', 'positioning_attachment_removed', 'battle_opened'));--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_subject_check" CHECK (num_nonnulls("gesture"."contact_id", "gesture"."positioning_id", "gesture"."battle_id") = 1 and ("gesture"."contact_id" is not null) = ("gesture"."kind" in ('contact_added', 'contact_edited', 'status_changed', 'follow_up_scheduled', 'follow_up_canceled', 'followed_up', 'interaction_noted', 'reply_recorded', 'positioning_used')) and ("gesture"."positioning_id" is not null) = ("gesture"."kind" in ('positioning_created', 'positioning_edited', 'positioning_relabeled', 'positioning_archived', 'positioning_unarchived', 'positioning_deleted', 'positioning_attachment_added', 'positioning_attachment_removed')));;--> statement-breakpoint
ALTER TABLE "stage" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "positioning" FORCE ROW LEVEL SECURITY;