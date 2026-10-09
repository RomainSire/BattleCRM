import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';

import { withoutIsolation, withUser } from './index.ts';

// `rls_probe` is created by the test harness with the policy every business table carries (ADR 0009).
const insertProbe = (userId: string, label: string) =>
  withUser(userId, (tx) =>
    tx.execute(sql`insert into rls_probe (user_id, label) values (${userId}, ${label})`),
  );

describe('row level security', () => {
  test('a query without any filter only sees the rows of its User', async () => {
    const alice = randomUUID();
    const bob = randomUUID();
    await insertProbe(alice, 'alice');
    await insertProbe(bob, 'bob');

    const rows = await withUser(
      bob,
      async (tx) => (await tx.execute(sql`select user_id, label from rls_probe`)).rows,
    );

    expect(rows).toEqual([{ user_id: bob, label: 'bob' }]);
  });

  test('a User cannot write a row for another User', async () => {
    const alice = randomUUID();
    const bob = randomUUID();

    const write = withUser(bob, (tx) =>
      tx.execute(sql`insert into rls_probe (user_id, label) values (${alice}, 'forged')`),
    );

    await expect(write).rejects.toThrow(postgresError(/violates row-level security policy/));
  });

  test('a business table cannot be read outside withUser, even after one on the same pool', async () => {
    const alice = randomUUID();
    await insertProbe(alice, 'alice');

    const read = withoutIsolation((db) =>
      db.execute(sql`select * from rls_probe where user_id = ${alice}`),
    );

    // Never set on this connection, or reset to '' once the transaction of withUser ended.
    await expect(read).rejects.toThrow(
      postgresError(
        /unrecognized configuration parameter "app.user_id"|invalid input syntax for type uuid: ""/,
      ),
    );
  });
});

/** Drizzle wraps the Postgres error in its own, as `cause`. */
function postgresError(message: RegExp) {
  return expect.objectContaining({
    cause: expect.objectContaining({ message: expect.stringMatching(message) }),
  });
}
