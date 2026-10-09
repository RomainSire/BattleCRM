-- The app role reads the migration journal for /api/health; every table grants its own rights to it.
GRANT USAGE ON SCHEMA drizzle TO battlecrm_app;
--> statement-breakpoint
GRANT SELECT ON drizzle.__drizzle_migrations TO battlecrm_app;
