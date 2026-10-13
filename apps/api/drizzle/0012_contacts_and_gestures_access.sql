-- Business tables: forced row level security on top of the user_id filter (ADR 0009).
GRANT SELECT, INSERT, UPDATE, DELETE ON "contact", "interaction", "gesture" TO battlecrm_app;
--> statement-breakpoint
ALTER TABLE "contact" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "contact" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "contact"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
--> statement-breakpoint
ALTER TABLE "interaction" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "interaction" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "interaction"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
--> statement-breakpoint
ALTER TABLE "gesture" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "gesture" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "gesture"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
