CREATE TABLE "effective_activity_goal" (
	"user_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"value" integer,
	CONSTRAINT "effective_activity_goal_user_id_effective_from_pk" PRIMARY KEY("user_id","effective_from"),
	CONSTRAINT "effective_activity_goal_value_check" CHECK ("effective_activity_goal"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "effective_entry_goal" (
	"user_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"value" integer,
	CONSTRAINT "effective_entry_goal_user_id_effective_from_pk" PRIMARY KEY("user_id","effective_from"),
	CONSTRAINT "effective_entry_goal_value_check" CHECK ("effective_entry_goal"."value" > 0),
	CONSTRAINT "effective_entry_goal_effective_from_check" CHECK (extract(isodow from "effective_entry_goal"."effective_from") = 1)
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "celebrate_goal" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "single_key_shortcuts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "check_in_rhythm_days" integer DEFAULT 28 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "circle_size_goal" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "follow_up_intervals" integer[] DEFAULT '{3,7,14}' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "response_window_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "effective_activity_goal" ADD CONSTRAINT "effective_activity_goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effective_entry_goal" ADD CONSTRAINT "effective_entry_goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_check_in_rhythm_days_check" CHECK ("user_settings"."check_in_rhythm_days" > 0);--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_circle_size_goal_check" CHECK ("user_settings"."circle_size_goal" > 0);--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_follow_up_intervals_check" CHECK (cardinality("user_settings"."follow_up_intervals") > 0 and 0 < all("user_settings"."follow_up_intervals"));--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_response_window_days_check" CHECK ("user_settings"."response_window_days" > 0);