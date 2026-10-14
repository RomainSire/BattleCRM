-- Business tables: forced row level security on top of the user_id filter (ADR 0009).
GRANT SELECT, INSERT, UPDATE, DELETE ON "stage", "status_change" TO battlecrm_app;
--> statement-breakpoint
ALTER TABLE "stage" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "stage" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "stage"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
--> statement-breakpoint
ALTER TABLE "status_change" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "status_change" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "status_change"
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);
--> statement-breakpoint
-- The accounts created before this version get the Standard stages (ST-37), in their language: the
-- texts of `standard_stage_*` as they are today, never translated afterwards. Each User in turn,
-- under row level security. Their Contacts, all in the Pool and without a Stage, get their first
-- Status written down, from none, on the Interaction that recorded their addition.
DO $$
DECLARE
  account record;
BEGIN
  FOR account IN SELECT id FROM "user" LOOP
    PERFORM set_config('app.user_id', account.id::text, true);
    INSERT INTO "stage" ("user_id", "name", "aim", "position")
    SELECT s.user_id, standard.name, standard.aim, standard.position
    FROM "user_settings" s
    JOIN (VALUES
      ('fr', 0, 'Approche', 'CV à envoyer'),
      ('fr', 1, 'Qualif ESN', 'entretien ESN à obtenir'),
      ('fr', 2, 'Qualif Client', 'entretien client à obtenir'),
      ('fr', 3, 'Closing', 'contrat à signer'),
      ('en', 0, 'Outreach', 'get asked for a CV'),
      ('en', 1, 'Agency screening', 'get the agency interview'),
      ('en', 2, 'Client screening', 'get the client interview'),
      ('en', 3, 'Closing', 'sign the contract')
    ) AS standard (locale, position, name, aim) ON standard.locale = s.locale
    WHERE s.user_id = account.id
      AND NOT EXISTS (SELECT 1 FROM "stage" WHERE "stage"."user_id" = account.id);
    INSERT INTO "status_change" ("user_id", "contact_id", "interaction_id", "from_status", "to_status")
    SELECT i.user_id, i.contact_id, i.id, NULL, c.status
    FROM "interaction" i JOIN "contact" c ON c.user_id = i.user_id AND c.id = i.contact_id
    WHERE i.user_id = account.id AND i.kind = 'contact_added'
      AND NOT EXISTS (SELECT 1 FROM "status_change" sc WHERE sc.user_id = i.user_id AND sc.contact_id = i.contact_id);
  END LOOP;
END
$$;
