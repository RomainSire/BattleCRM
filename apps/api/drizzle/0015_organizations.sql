-- The foreign key below is checked by the owner, which forced row level security would blind:
-- forced again at the end of this migration.
ALTER TABLE "contact" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "organization_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "organization_name_check" CHECK ("organization"."name" <> ''),
	CONSTRAINT "organization_normalized_name_check" CHECK ("organization"."normalized_name" <> ''),
	CONSTRAINT "organization_type_check" CHECK ("organization"."type" in ('consultancy', 'end_client'))
);
--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_normalized_name_unique" ON "organization" USING btree ("user_id","normalized_name");--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_organization_fk" FOREIGN KEY ("user_id","organization_id") REFERENCES "public"."organization"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_linkedin_url_unique" ON "contact" USING btree ("user_id","linkedin_url");--> statement-breakpoint
CREATE INDEX "contact_organization_idx" ON "contact" USING btree ("user_id","organization_id");--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_job_title_check" CHECK ("contact"."job_title" <> '');--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_email_check" CHECK ("contact"."email" <> '');--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_phone_check" CHECK ("contact"."phone" <> '');--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_linkedin_url_check" CHECK ("contact"."linkedin_url" <> '');--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_note_check" CHECK ("contact"."note" <> '');--> statement-breakpoint
ALTER TABLE "contact" FORCE ROW LEVEL SECURITY;
