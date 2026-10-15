-- Business tables: forced row level security on top of the user_id filter (ADR 0009).
GRANT SELECT, INSERT, UPDATE, DELETE ON "attachment_blob" TO battlecrm_app;
--> statement-breakpoint
ALTER TABLE "attachment_blob" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "attachment_blob" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "attachment_blob"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "positioning_attachment" TO battlecrm_app;
--> statement-breakpoint
ALTER TABLE "positioning_attachment" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "positioning_attachment" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "positioning_attachment"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
