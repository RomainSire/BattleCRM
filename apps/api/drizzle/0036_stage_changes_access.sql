-- Business tables: forced row level security on top of the user_id filter (ADR 0009).
GRANT SELECT, INSERT, UPDATE, DELETE ON "stage_change" TO battlecrm_app;
--> statement-breakpoint
ALTER TABLE "stage_change" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "stage_change" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "stage_change"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
