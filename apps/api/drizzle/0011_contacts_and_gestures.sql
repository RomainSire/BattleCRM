CREATE TABLE "gesture" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"contact_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"performed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "gesture_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "gesture_kind_check" CHECK ("gesture"."kind" in ('contact_added'))
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "contact_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "contact_status_check" CHECK ("contact"."status" in ('pool', 'prospecting', 'ally', 'archived')),
	CONSTRAINT "contact_name_check" CHECK ("contact"."name" <> '')
);
--> statement-breakpoint
CREATE TABLE "interaction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"direction" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "interaction_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "interaction_kind_check" CHECK ("interaction"."kind" in ('contact_added')),
	CONSTRAINT "interaction_direction_check" CHECK ("interaction"."direction" in ('outbound', 'inbound', 'none'))
);
--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_contact_fk" FOREIGN KEY ("user_id","contact_id") REFERENCES "public"."contact"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_contact_fk" FOREIGN KEY ("user_id","contact_id") REFERENCES "public"."contact"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gesture_contact_idx" ON "gesture" USING btree ("user_id","contact_id");--> statement-breakpoint
CREATE INDEX "interaction_contact_idx" ON "interaction" USING btree ("user_id","contact_id","occurred_at");