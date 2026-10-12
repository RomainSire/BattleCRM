-- Outside row level security, like every auth table (ADR 0010): read at a sign-in, before the User is known.
GRANT SELECT, INSERT, UPDATE, DELETE ON "known_device" TO battlecrm_app;
