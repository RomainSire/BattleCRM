CREATE TABLE "attachment_blob" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" "bytea" NOT NULL,
	CONSTRAINT "attachment_blob_user_id_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "positioning_attachment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"positioning_id" uuid NOT NULL,
	"blob_id" uuid NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"added_at" timestamp with time zone NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "positioning_attachment_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "positioning_attachment_name_check" CHECK ("positioning_attachment"."name" <> ''),
	CONSTRAINT "positioning_attachment_size_check" CHECK ("positioning_attachment"."size" >= 0)
);
--> statement-breakpoint
ALTER TABLE "gesture" DROP CONSTRAINT "gesture_kind_check";--> statement-breakpoint
ALTER TABLE "gesture" DROP CONSTRAINT "gesture_subject_check";--> statement-breakpoint
ALTER TABLE "attachment_blob" ADD CONSTRAINT "attachment_blob_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positioning_attachment" ADD CONSTRAINT "positioning_attachment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positioning_attachment" ADD CONSTRAINT "positioning_attachment_blob_fk" FOREIGN KEY ("user_id","blob_id") REFERENCES "public"."attachment_blob"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "positioning_attachment_positioning_idx" ON "positioning_attachment" USING btree ("user_id","positioning_id");--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_kind_check" CHECK ("gesture"."kind" in ('contact_added', 'contact_edited', 'status_changed', 'follow_up_scheduled', 'follow_up_canceled', 'followed_up', 'interaction_noted', 'reply_recorded', 'positioning_created', 'positioning_edited', 'positioning_relabeled', 'positioning_archived', 'positioning_unarchived', 'positioning_deleted', 'positioning_attachment_added', 'positioning_attachment_removed'));--> statement-breakpoint
ALTER TABLE "gesture" ADD CONSTRAINT "gesture_subject_check" CHECK (("gesture"."contact_id" is null) = ("gesture"."kind" in ('positioning_created', 'positioning_edited', 'positioning_relabeled', 'positioning_archived', 'positioning_unarchived', 'positioning_deleted', 'positioning_attachment_added', 'positioning_attachment_removed')) and ("gesture"."positioning_id" is null) <> ("gesture"."contact_id" is null));