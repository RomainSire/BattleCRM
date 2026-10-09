import { randomUUID } from 'node:crypto';

import { Client, type QueryResult, type QueryResultRow } from 'pg';
import type { TestProject } from 'vitest/node';

import { runMigrations } from '../src/db/index.ts';
import { appUrl, ownerUrl, superuserUrl } from './postgres.ts';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** One database per run, migrated from scratch by the real migrations; every test then creates its own User. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const database = `battlecrm_test_${randomUUID().replaceAll('-', '')}`;
  const drop = () =>
    run(superuserUrl('postgres'), `drop database if exists ${database} with (force)`);
  await run(superuserUrl('postgres'), `create database ${database} owner battlecrm_owner`);
  try {
    await runMigrations(ownerUrl(database), new URL('../drizzle', import.meta.url).pathname);
    await run(ownerUrl(database), RLS_PROBE);
    await refuseRolesAboveRowLevelSecurity(appUrl(database));
  } catch (error) {
    await drop();
    throw error;
  }

  project.provide('databaseUrl', appUrl(database));
  return drop;
}

/** A superuser or a BYPASSRLS role sees every row, even under forced row level security: such a run proves nothing. */
async function refuseRolesAboveRowLevelSecurity(url: string): Promise<void> {
  const result = await query<{ rolsuper: boolean; rolbypassrls: boolean }>(
    url,
    'select rolsuper, rolbypassrls from pg_roles where rolname = current_user',
  );
  const role = result.rows[0];
  if (!role || role.rolsuper || role.rolbypassrls) {
    throw new Error('Tests must connect under the app role: neither superuser nor BYPASSRLS');
  }
}

/** A test-only table that follows the pattern of every business table, to prove row level security (ADR 0009). */
const RLS_PROBE = `
  create table rls_probe (
    id uuid primary key default uuidv7(),
    user_id uuid not null,
    label text not null
  );
  alter table rls_probe enable row level security;
  alter table rls_probe force row level security;
  create policy user_isolation on rls_probe
    using (user_id = current_setting('app.user_id')::uuid)
    with check (user_id = current_setting('app.user_id')::uuid);
  grant select, insert, update, delete on rls_probe to battlecrm_app;
`;

async function run(url: string, sql: string): Promise<void> {
  await query(url, sql);
}

async function query<Row extends QueryResultRow>(
  url: string,
  sql: string,
): Promise<QueryResult<Row>> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await client.query<Row>(sql);
  } finally {
    await client.end();
  }
}
