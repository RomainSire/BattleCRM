#!/bin/sh
# Creates the two roles of ADR 0009 and hands the database to the owner.
# Runs as the superuser: from docker-entrypoint-initdb.d, or by hand with the PG* variables set (CI).
set -eu

psql -v ON_ERROR_STOP=1 \
  -v owner_password="$OWNER_PASSWORD" \
  -v app_password="$APP_PASSWORD" \
  -v database="$POSTGRES_DB" <<'SQL'
-- Owns the schema and runs the migrations, through the `migrate` entry point only.
CREATE ROLE battlecrm_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'owner_password';
-- The only role the API knows: owns nothing, so row level security always applies to it.
CREATE ROLE battlecrm_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'app_password';
ALTER DATABASE :"database" OWNER TO battlecrm_owner;
SQL
