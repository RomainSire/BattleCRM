-- Business tables: forced row level security on top of the user_id filter (ADR 0009).
GRANT SELECT, INSERT, UPDATE, DELETE ON "follow_up" TO battlecrm_app;
--> statement-breakpoint
ALTER TABLE "follow_up" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "follow_up" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "follow_up"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
