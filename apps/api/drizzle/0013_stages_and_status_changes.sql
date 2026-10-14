-- The foreign keys below are checked by the owner, which forced row level security would blind:
-- forced again at the end of this migration.
ALTER TABLE "contact" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interaction" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stage" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"aim" text,
	"position" integer NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "stage_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "stage_name_check" CHECK ("stage"."name" <> ''),
	CONSTRAINT "stage_aim_check" CHECK ("stage"."aim" <> '')
);
--> statement-breakpoint
CREATE TABLE "status_change" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"interaction_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"stage_id" uuid,
	"reason" text,
	CONSTRAINT "status_change_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "status_change_interaction_unique" UNIQUE("user_id","interaction_id"),
	CONSTRAINT "status_change_from_status_check" CHECK ("status_change"."from_status" in ('pool', 'prospecting', 'ally', 'archived')),
	CONSTRAINT "status_change_to_status_check" CHECK ("status_change"."to_status" in ('pool', 'prospecting', 'ally', 'archived')),
	CONSTRAINT "status_change_change_check" CHECK ("status_change"."from_status" is distinct from "status_change"."to_status"),
	CONSTRAINT "status_change_prospecting_stage_check" CHECK ("status_change"."to_status" <> 'prospecting' or "status_change"."stage_id" is not null),
	CONSTRAINT "status_change_reason_check" CHECK ("status_change"."reason" <> '')
);
--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "stage_id" uuid;--> statement-breakpoint
ALTER TABLE "stage" ADD CONSTRAINT "stage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_change" ADD CONSTRAINT "status_change_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_change" ADD CONSTRAINT "status_change_contact_fk" FOREIGN KEY ("user_id","contact_id") REFERENCES "public"."contact"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_change" ADD CONSTRAINT "status_change_interaction_fk" FOREIGN KEY ("user_id","interaction_id") REFERENCES "public"."interaction"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_change" ADD CONSTRAINT "status_change_stage_fk" FOREIGN KEY ("user_id","stage_id") REFERENCES "public"."stage"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "status_change_contact_idx" ON "status_change" USING btree ("user_id","contact_id");--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_stage_fk" FOREIGN KEY ("user_id","stage_id") REFERENCES "public"."stage"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_prospecting_stage_check" CHECK ("contact"."status" <> 'prospecting' or "contact"."stage_id" is not null);--> statement-breakpoint
ALTER TABLE "contact" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interaction" FORCE ROW LEVEL SECURITY;
