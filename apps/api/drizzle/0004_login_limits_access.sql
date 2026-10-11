-- Outside row level security, like every auth table (ADR 0010): both are counters, erased once they have expired.
GRANT SELECT, INSERT, UPDATE, DELETE ON "rate_limit", "login_attempt" TO battlecrm_app;
