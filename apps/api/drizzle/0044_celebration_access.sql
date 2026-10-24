-- Business tables: forced row level security on top of the user_id filter (ADR 0009).
GRANT SELECT, INSERT, UPDATE, DELETE ON "celebration" TO battlecrm_app;
--> statement-breakpoint
ALTER TABLE "celebration" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "celebration" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "celebration"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
