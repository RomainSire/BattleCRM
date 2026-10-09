import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

import journal from '../../drizzle/meta/_journal.json' with { type: 'json' };

/** The `when` of this version's latest migration, which drizzle records as `created_at` once applied. */
export const latestMigration: number = journal.entries.at(-1)?.when ?? 0;

/** Applies the pending migrations, under the owner role (ADR 0009). */
export async function runMigrations(url: string, migrationsFolder: string): Promise<void> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder });
  } finally {
    await pool.end();
  }
}
