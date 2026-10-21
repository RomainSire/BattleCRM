-- The foreign keys below are checked by the owner, which forced row level security would blind:
-- forced again at the end of this migration.
ALTER TABLE "contact" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interaction" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "positioning" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "battle" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assignment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"battle_id" uuid NOT NULL,
	"positioning_id" uuid NOT NULL,
	"target" text NOT NULL,
	"assigned_at" timestamp with time zone NOT NULL,
	CONSTRAINT "assignment_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "assignment_target_check" CHECK ("assignment"."target" in ('consultancy', 'end_client', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "trial" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"battle_id" uuid NOT NULL,
	"positioning_id" uuid NOT NULL,
	"interaction_id" uuid NOT NULL,
	"target" text NOT NULL,
	"overridden" boolean NOT NULL,
	"override_reason" text,
	"outcome" text NOT NULL,
	"cancel_reason" text,
	CONSTRAINT "trial_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "trial_interaction_unique" UNIQUE("user_id","interaction_id"),
	CONSTRAINT "trial_target_check" CHECK ("trial"."target" in ('consultancy', 'end_client', 'unknown')),
	CONSTRAINT "trial_outcome_check" CHECK ("trial"."outcome" in ('in_progress', 'success', 'no_result', 'canceled')),
	CONSTRAINT "trial_override_reason_check" CHECK ("trial"."override_reason" is null or ("trial"."override_reason" <> '' and "trial"."overridden")),
	CONSTRAINT "trial_cancel_reason_check" CHECK (("trial"."outcome" = 'canceled') = ("trial"."cancel_reason" is not null) and ("trial"."cancel_reason" is null or "trial"."cancel_reason" <> ''))
);
--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_contact_fk" FOREIGN KEY ("user_id","contact_id") REFERENCES "public"."contact"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_battle_fk" FOREIGN KEY ("user_id","battle_id") REFERENCES "public"."battle"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_positioning_fk" FOREIGN KEY ("user_id","positioning_id") REFERENCES "public"."positioning"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "trial_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "trial_contact_fk" FOREIGN KEY ("user_id","contact_id") REFERENCES "public"."contact"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "trial_battle_fk" FOREIGN KEY ("user_id","battle_id") REFERENCES "public"."battle"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "trial_positioning_fk" FOREIGN KEY ("user_id","positioning_id") REFERENCES "public"."positioning"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "trial_interaction_fk" FOREIGN KEY ("user_id","interaction_id") REFERENCES "public"."interaction"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_contact_unique" ON "assignment" USING btree ("user_id","contact_id");--> statement-breakpoint
CREATE INDEX "assignment_battle_idx" ON "assignment" USING btree ("user_id","battle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trial_in_progress_unique" ON "trial" USING btree ("user_id","contact_id") WHERE "trial"."outcome" = 'in_progress';--> statement-breakpoint
CREATE UNIQUE INDEX "trial_per_battle_unique" ON "trial" USING btree ("user_id","contact_id","battle_id") WHERE "trial"."outcome" <> 'canceled';--> statement-breakpoint
CREATE INDEX "trial_battle_idx" ON "trial" USING btree ("user_id","battle_id");--> statement-breakpoint
CREATE INDEX "trial_positioning_idx" ON "trial" USING btree ("user_id","positioning_id");--> statement-breakpoint
ALTER TABLE "contact" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interaction" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "positioning" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "battle" FORCE ROW LEVEL SECURITY;
