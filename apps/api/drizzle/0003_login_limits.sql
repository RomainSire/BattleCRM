CREATE TABLE "login_attempt" (
	"email" text PRIMARY KEY NOT NULL,
	"failures" integer NOT NULL,
	"last_attempt_at" timestamp with time zone NOT NULL,
	"blocked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
