-- Business tables: forced row level security on top of the user_id filter (ADR 0009).
GRANT SELECT, INSERT, UPDATE, DELETE ON "assignment", "trial" TO battlecrm_app;
--> statement-breakpoint
ALTER TABLE "assignment" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "assignment" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "assignment"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
--> statement-breakpoint
ALTER TABLE "trial" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "trial" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "trial"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
