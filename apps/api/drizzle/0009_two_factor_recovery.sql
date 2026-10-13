CREATE TABLE "two_factor_recovery" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"reminder_token_hash" text,
	"requested_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"reminded_at" timestamp with time zone,
	CONSTRAINT "two_factor_recovery_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "two_factor_recovery" ADD CONSTRAINT "two_factor_recovery_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;