import { Client, DatabaseError } from 'pg';

/**
 * Fails fast, saying what to do, when Postgres cannot be reached at all.
 * An answer from Postgres itself (a wrong password, a missing database) is rethrown as it is.
 */
export async function assertPostgresReachable(url: string): Promise<void> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new Error(
      `Postgres at ${new URL(url).host} is unreachable. For the dev database: start it with ` +
        '`docker compose -f compose.dev.yml up -d`. If it already runs, a VPN on this machine ' +
        'is blocking it: ask Romain to turn the VPN off, then run again.',
      { cause: error },
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}
