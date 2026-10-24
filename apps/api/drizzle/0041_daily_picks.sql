-- The foreign keys below are checked by the owner, which forced row level security would blind:
-- forced again at the end of this migration.
ALTER TABLE "contact" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "battle" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "battle_postponement" (
	"user_id" uuid NOT NULL,
	"battle_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	CONSTRAINT "battle_postponement_user_id_battle_id_local_date_pk" PRIMARY KEY("user_id","battle_id","local_date")
);
--> statement-breakpoint
CREATE TABLE "daily_pick" (
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"kind" text NOT NULL,
	"contact_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	CONSTRAINT "daily_pick_user_id_local_date_kind_contact_id_pk" PRIMARY KEY("user_id","local_date","kind","contact_id"),
	CONSTRAINT "daily_pick_kind_check" CHECK ("daily_pick"."kind" in ('entry', 'no_next_step')),
	CONSTRAINT "daily_pick_rank_check" CHECK ("daily_pick"."rank" >= 0)
);
--> statement-breakpoint
ALTER TABLE "battle_postponement" ADD CONSTRAINT "battle_postponement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_postponement" ADD CONSTRAINT "battle_postponement_battle_fk" FOREIGN KEY ("user_id","battle_id") REFERENCES "public"."battle"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_pick" ADD CONSTRAINT "daily_pick_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_pick" ADD CONSTRAINT "daily_pick_contact_fk" FOREIGN KEY ("user_id","contact_id") REFERENCES "public"."contact"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "battle" FORCE ROW LEVEL SECURITY;
