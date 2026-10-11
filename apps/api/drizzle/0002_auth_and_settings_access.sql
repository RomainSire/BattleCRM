-- Auth tables sit outside row level security (ADR 0010), with limited rights for the app role:
-- nothing deletes a User or its password in this version.
GRANT SELECT, INSERT, UPDATE ON "user", "account" TO battlecrm_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "session", "verification", "pending_signup" TO battlecrm_app;
--> statement-breakpoint
-- Settings are business tables: forced row level security on top of the user_id filter (ADR 0009).
GRANT SELECT, INSERT, UPDATE, DELETE ON "user_settings", "effective_time_zone" TO battlecrm_app;
--> statement-breakpoint
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "user_settings"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
--> statement-breakpoint
ALTER TABLE "effective_time_zone" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "effective_time_zone" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "effective_time_zone"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
