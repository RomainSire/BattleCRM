-- Business tables: forced row level security on top of the user_id filter (ADR 0009).
GRANT SELECT, INSERT, UPDATE, DELETE ON "daily_pick" TO battlecrm_app;
--> statement-breakpoint
ALTER TABLE "daily_pick" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "daily_pick" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "daily_pick"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "battle_postponement" TO battlecrm_app;
--> statement-breakpoint
ALTER TABLE "battle_postponement" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "battle_postponement" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "battle_postponement"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
