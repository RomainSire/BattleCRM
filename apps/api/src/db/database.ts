import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Logger } from 'pino';

import { latestMigration } from './migrations.ts';

// No `schema` is ever passed to drizzle(): the relational `db.query…` API stays out of reach (spec stack §6).
export type Database = NodePgDatabase;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

let opened: { pool: Pool; db: Database } | undefined;

export function openDatabase(url: string, logger: Logger): void {
  if (opened) throw new Error('The database is already open');
  const pool = new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5_000 });
  // An idle client losing its connection must not crash the process: the pool replaces it.
  pool.on('error', (error) => logger.error({ err: error }, 'idle database client failed'));
  opened = { pool, db: drizzle({ client: pool }) };
}

export async function closeDatabase(): Promise<void> {
  const pool = opened?.pool;
  opened = undefined;
  await pool?.end();
}

function db(): Database {
  if (!opened) throw new Error('The database is not open');
  return opened.db;
}

/**
 * Runs a business query as one User, in one transaction (ADR 0009).
 * Row level security only lets the transaction see and write that User's rows,
 * on top of the `user_id` filter every query still writes.
 */
export function withUser<T>(userId: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}

/** For `auth` only (lint): Better Auth tables are read before the User is known, and sit outside row level security. */
export function withoutIsolation<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  return fn(db());
}

/**
 * For /api/health: the database answers and this version's latest migration is applied.
 * "At least", never "equal": after a rollback, the previous API runs on a newer schema (expand/contract).
 */
export async function isDatabaseReady(migration = latestMigration): Promise<boolean> {
  try {
    const result = await db().execute<{ ready: boolean }>(
      sql`select exists (select 1 from drizzle.__drizzle_migrations where created_at >= ${migration}) as ready`,
    );
    return result.rows[0]?.ready === true;
  } catch {
    return false;
  }
}
