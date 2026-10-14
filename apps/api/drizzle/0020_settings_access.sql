-- Business tables: forced row level security on top of the user_id filter (ADR 0009).
GRANT SELECT, INSERT, UPDATE, DELETE ON "effective_activity_goal", "effective_entry_goal" TO battlecrm_app;
--> statement-breakpoint
ALTER TABLE "effective_activity_goal" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "effective_activity_goal" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "effective_activity_goal"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
--> statement-breakpoint
ALTER TABLE "effective_entry_goal" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "effective_entry_goal" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "effective_entry_goal"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
