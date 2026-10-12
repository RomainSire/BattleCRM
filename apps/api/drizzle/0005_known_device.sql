CREATE TABLE "known_device" (
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "known_device_user_id_token_hash_pk" PRIMARY KEY("user_id","token_hash")
);
--> statement-breakpoint
ALTER TABLE "known_device" ADD CONSTRAINT "known_device_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;