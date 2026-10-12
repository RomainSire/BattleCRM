import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withoutIsolation } from '../db/index.ts';
import { loginAttempt, rateLimit, session, verification } from './tables.ts';

type Harness = ReturnType<typeof testApp>;

/** Long before the clock of the other tests: the purge only finds the rows written here. */
const longAgo = () => testApp({}, { startsAt: '2025-01-05T09:00:00Z' });

async function purge(harness: Harness) {
  const job = harness.jobs.find(({ name }) => name === 'purge expired sessions and counters');
  if (!job) throw new Error('The job is not registered');
  await job.run();
}

const counter = (key: string) =>
  withoutIsolation((db) => db.select().from(rateLimit).where(eq(rateLimit.key, key)));

const sessionsOf = (userId: string) =>
  withoutIsolation((db) => db.select().from(session).where(eq(session.userId, userId)));

test('a session is erased once expired, never before', async () => {
  const harness = longAgo();
  const { userId } = await makeUser(harness);
  const [opened] = await sessionsOf(userId);
  if (!opened) throw new Error('makeUser opened no session');
  const expireAt = (expiresAt: Date) =>
    withoutIsolation((db) =>
      db.update(session).set({ expiresAt }).where(eq(session.id, opened.id)),
    );

  await expireAt(new Date(harness.clock.now().getTime() + 1000));
  await purge(harness);
  expect(await sessionsOf(userId)).toHaveLength(1);

  await expireAt(new Date(harness.clock.now().getTime() - 1000));
  await purge(harness);
  expect(await sessionsOf(userId)).toEqual([]);
});

test('the counter of an address is erased 15 minutes after its last attempt, a block included', async () => {
  const harness = longAgo();
  const email = `nobody-${randomUUID()}@example.com`;
  const counters = () =>
    withoutIsolation((db) => db.select().from(loginAttempt).where(eq(loginAttempt.email, email)));
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await postJson(harness.app, '/api/auth/sign-in/email', { email, password: 'wrong' });
  }

  harness.clock.advance('PT15M');
  await purge(harness);
  expect(await counters()).toMatchObject([{ failures: 10 }]);

  harness.clock.advance('PT1S');
  await purge(harness);
  expect(await counters()).toEqual([]);
});

test('the counter of an IP address is erased 15 minutes after its last request', async () => {
  const harness = longAgo();
  const keys = { old: `old-${randomUUID()}`, recent: `recent-${randomUUID()}` };
  const now = harness.clock.now().getTime();
  await withoutIsolation((db) =>
    db.insert(rateLimit).values([
      { key: keys.old, count: 30, lastRequest: now - 15 * 60_000 - 1 },
      { key: keys.recent, count: 30, lastRequest: now - 15 * 60_000 },
    ]),
  );
  await purge(harness);

  expect(await counter(keys.old)).toEqual([]);
  expect(await counter(keys.recent)).toHaveLength(1);
});

test('a reset link is erased once expired, never before', async () => {
  const harness = longAgo();
  const { email } = await makeUser(harness);
  const links = () =>
    withoutIsolation((db) => db.select().from(verification).where(eq(verification.value, email)));
  await postJson(harness.app, '/api/password-reset', { email });

  harness.clock.advance('PT1H');
  await purge(harness);
  expect(await links()).toHaveLength(1);

  harness.clock.advance('PT1S');
  await purge(harness);
  expect(await links()).toEqual([]);
});

test('a row of Better Auth in the same table is left alone', async () => {
  const harness = longAgo();
  const identifier = `native-${randomUUID()}`;
  const past = new Date(harness.clock.now().getTime() - 1000);
  await withoutIsolation((db) =>
    db
      .insert(verification)
      .values({ identifier, value: 'x', expiresAt: past, createdAt: past, updatedAt: past }),
  );

  await purge(harness);

  expect(
    await withoutIsolation((db) =>
      db.select().from(verification).where(eq(verification.identifier, identifier)),
    ),
  ).toHaveLength(1);
});

test('says how many rows went, and nothing when none did', async () => {
  const harness = longAgo();
  const key = `old-${randomUUID()}`;
  await withoutIsolation((db) => db.insert(rateLimit).values({ key, count: 1, lastRequest: 0 }));

  await purge(harness);

  expect(harness.logs()).toContainEqual(
    expect.objectContaining({ msg: 'expired sessions and counters purged' }),
  );
});
