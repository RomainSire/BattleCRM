-- Business tables: forced row level security on top of the user_id filter (ADR 0009).
GRANT SELECT, INSERT, UPDATE, DELETE ON "trial_deviation" TO battlecrm_app;
--> statement-breakpoint
ALTER TABLE "trial_deviation" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "trial_deviation" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "trial_deviation"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
