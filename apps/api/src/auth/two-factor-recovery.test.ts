import { and, eq, like } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { GOOD_PASSWORD, testApp } from '../../test/app.ts';
import { makeUser } from '../../test/factories/user.ts';
import { cookiesOf, postJson } from '../../test/http.ts';
import { totpCode, wrongTotpCode } from '../../test/totp.ts';
import { withoutIsolation } from '../db/index.ts';
import { twoFactorRecovery, verification } from './tables.ts';

type Harness = ReturnType<typeof testApp>;

const NEW_PASSWORD = 'a brand new passphrase';
const STARTED_SUBJECTS = [
  'Récupération de la double authentification demandée',
  'Two-factor authentication recovery requested',
];
const REMINDER_SUBJECTS = [
  'Rappel : la double authentification sera bientôt désactivée',
  'Reminder: two-factor authentication will soon be turned off',
];
const COMPLETED_SUBJECTS = [
  'Récupération terminée : la double authentification est désactivée',
  'Recovery complete: two-factor authentication is off',
];

/** Long before the clock of the other tests: the deadlines only find the rows written here. */
const longAgo = () => testApp({}, { startsAt: '2025-03-03T09:00:00Z' });

async function runDeadlines(harness: Harness) {
  const job = harness.jobs.find(({ name }) => name === 'two-factor recovery deadlines');
  if (!job) throw new Error('The job is not registered');
  await job.run();
}

const signIn = (harness: Harness, email: string, password: string) =>
  postJson(harness.app, '/api/auth/sign-in/email', { email, password });

const giveTotp = (harness: Harness, challenge: string, code: string) =>
  postJson(harness.app, '/api/auth/two-factor/verify-totp', { code }, challenge);

const giveBackupCode = (harness: Harness, challenge: string, code: unknown) =>
  postJson(harness.app, '/api/auth/two-factor/verify-backup-code', { code }, challenge);

const requestRecovery = (harness: Harness, challenge?: string) =>
  postJson(harness.app, '/api/two-factor-recovery', {}, challenge);

const cancelRecovery = (harness: Harness, token: unknown) =>
  postJson(harness.app, '/api/two-factor-recovery/cancel', { token });

/** A User whose second factor is on: the key, the backup codes, and the session that turned it on. */
async function withSecondFactor(harness: Harness, options?: Parameters<typeof makeUser>[1]) {
  const user = await makeUser(harness, options);
  const start = await postJson(
    harness.app,
    '/api/account/two-factor',
    { password: user.password },
    user.cookie,
  );
  const { totpUri } = z.object({ totpUri: z.string() }).parse(await start.json());
  const confirmed = await postJson(
    harness.app,
    '/api/account/two-factor/confirm',
    { password: user.password, code: totpCode(totpUri) },
    user.cookie,
  );
  expect(confirmed.status).toBe(200);
  const { backupCodes } = z
    .object({ backupCodes: z.array(z.string()) })
    .parse(await confirmed.json());
  return { ...user, totpUri, backupCodes, cookie: cookiesOf(confirmed) };
}

type Protected = Awaited<ReturnType<typeof withSecondFactor>>;

/** The first step of a sign-in: the password is right, a code is awaited. Returns the challenge cookie. */
async function challenged(harness: Harness, user: { email: string; password: string }) {
  const response = await signIn(harness, user.email, user.password);
  expect(await response.json()).toEqual({ twoFactorRequired: true });
  return cookiesOf(response);
}

/** A User who lost the second factor and asked for a recovery, at the clock of the harness. */
async function recovering(harness: Harness, options?: Parameters<typeof makeUser>[1]) {
  const user = await withSecondFactor(harness, options);
  const response = await requestRecovery(harness, await challenged(harness, user));
  expect(response.status).toBe(200);
  return user;
}

async function emailsTo(harness: Harness, email: string, subjects: string[]) {
  return (await harness.emails()).filter(
    (message) => message.to === email && subjects.includes(message.subject),
  );
}

/** The token of “Cancel” in the latest e-mail of these subjects. */
async function cancelToken(harness: Harness, email: string, subjects = STARTED_SUBJECTS) {
  const sent = (await emailsTo(harness, email, subjects)).at(-1);
  const token = sent && /\/cancel-two-factor-recovery#(\S+)/.exec(sent.text)?.[1];
  if (!token) throw new Error(`No link to cancel was sent to ${email}`);
  return token;
}

const recoveriesOf = (userId: string) =>
  withoutIsolation((db) =>
    db.select().from(twoFactorRecovery).where(eq(twoFactorRecovery.userId, userId)),
  );

/** Whether a code is still asked of this User, told by a sign-in with the password. */
async function codeAsked(harness: Harness, user: { email: string }, password = GOOD_PASSWORD) {
  const response = await signIn(harness, user.email, password);
  expect(response.status).toBe(200);
  const answer = z
    .union([z.object({ twoFactorRequired: z.literal(true) }), z.object({ email: z.string() })])
    .parse(await response.json());
  return 'twoFactorRequired' in answer;
}

describe('asking for a recovery', () => {
  test('from the code screen: the second factor goes in 7 days, and an e-mail says so', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);

    const response = await requestRecovery(harness, await challenged(harness, user));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ dueAt: '2026-01-12T09:00:00.000Z' });
    // No session: the password proved half.
    expect(response.headers.getSetCookie().join('\n')).not.toMatch(/session_token=[^;]/);
    const [sent, ...others] = await emailsTo(harness, user.email, STARTED_SUBJECTS);
    expect(others).toEqual([]);
    // In the language and the time zone of the User.
    expect(sent?.subject).toBe(STARTED_SUBJECTS[0]);
    expect(sent?.text).toContain('12 janvier 2026 à 10:00 UTC+1');
    expect(sent?.text).toMatch(
      /https:\/\/app\.battlecrm\.test\/cancel-two-factor-recovery#[\w-]{43}(\s|$)/,
    );
    expect(sent?.text).toContain('https://app.battlecrm.test/forgot-password');
    // Nothing changes until then.
    expect(await codeAsked(harness, user)).toBe(true);
  });

  test('the e-mail follows the language and the time zone of the User', async () => {
    const harness = testApp();
    const user = await recovering(harness, { locale: 'en', timeZone: 'America/New_York' });

    const [sent] = await emailsTo(harness, user.email, STARTED_SUBJECTS);

    expect(sent?.subject).toBe(STARTED_SUBJECTS[1]);
    expect(sent?.text).toContain('January 12, 2026 at 4:00 AM EST');
  });

  test('the token of the link is kept as a hash only', async () => {
    const harness = testApp();
    const user = await recovering(harness);
    const token = await cancelToken(harness, user.email);

    const [row] = await recoveriesOf(user.userId);

    expect(row?.tokenHash).toMatch(/^[\da-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(token);
  });

  test('without the password just before, nothing is asked', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);

    const bare = await requestRecovery(harness);
    // A session is no challenge: a signed-in User turns the second factor off with the password.
    const signedIn = await requestRecovery(harness, user.cookie);

    for (const response of [bare, signedIn]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'challenge_expired' });
    }
    expect(await recoveriesOf(user.userId)).toEqual([]);
    expect(await emailsTo(harness, user.email, STARTED_SUBJECTS)).toEqual([]);
  });

  test('a challenge that expired asks nothing', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const challenge = await challenged(harness, user);
    await withoutIsolation((db) =>
      db
        .update(verification)
        .set({ expiresAt: new Date(harness.clock.now().getTime() - 1000) })
        // The challenge of this User alone: its value is the id of the User it awaits.
        .where(and(like(verification.identifier, '2fa-%'), eq(verification.value, user.userId))),
    );

    const response = await requestRecovery(harness, challenge);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'challenge_expired' });
    expect(await recoveriesOf(user.userId)).toEqual([]);
  });

  test('asked again, it keeps its date and sends nothing more', async () => {
    const harness = testApp();
    const user = await recovering(harness);
    harness.clock.advance('P2D');

    const again = await requestRecovery(harness, await challenged(harness, user));

    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ dueAt: '2026-01-12T09:00:00.000Z' });
    expect(await emailsTo(harness, user.email, STARTED_SUBJECTS)).toHaveLength(1);
  });

  test('two requests sent together start a single recovery', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const challenge = await challenged(harness, user);

    const responses = await Promise.all([
      requestRecovery(harness, challenge),
      requestRecovery(harness, challenge),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await recoveriesOf(user.userId)).toHaveLength(1);
    expect(await emailsTo(harness, user.email, STARTED_SUBJECTS)).toHaveLength(1);
  });
});

describe('cancelling a recovery', () => {
  test('the link of the e-mail cancels it, once', async () => {
    const harness = longAgo();
    const user = await recovering(harness);
    const token = await cancelToken(harness, user.email);

    const response = await cancelRecovery(harness, token);
    const again = await cancelRecovery(harness, token);

    expect(response.status).toBe(204);
    expect(again.status).toBe(400);
    expect(await again.json()).toEqual({ error: 'invalid_link' });
    harness.clock.advance('P7D');
    await runDeadlines(harness);
    expect(await codeAsked(harness, user)).toBe(true);
    expect(await emailsTo(harness, user.email, COMPLETED_SUBJECTS)).toEqual([]);
  });

  test('a link nobody sent cancels nothing', async () => {
    const harness = testApp();
    const user = await recovering(harness);

    const response = await cancelRecovery(harness, 'not-a-token');

    expect(response.status).toBe(400);
    expect(await recoveriesOf(user.userId)).toHaveLength(1);
  });

  test('a sign-in with a code of the app cancels it', async () => {
    const harness = longAgo();
    const user = await recovering(harness);

    const response = await giveTotp(
      harness,
      await challenged(harness, user),
      totpCode(user.totpUri),
    );

    expect(response.status).toBe(200);
    expect(await recoveriesOf(user.userId)).toEqual([]);
    harness.clock.advance('P7D');
    await runDeadlines(harness);
    expect(await codeAsked(harness, user)).toBe(true);
  });

  test('a sign-in with a backup code cancels it', async () => {
    const harness = testApp();
    const user = await recovering(harness);

    const response = await giveBackupCode(
      harness,
      await challenged(harness, user),
      user.backupCodes[0],
    );

    expect(response.status).toBe(200);
    expect(await recoveriesOf(user.userId)).toEqual([]);
  });

  test('a wrong code cancels nothing', async () => {
    const harness = testApp();
    const user = await recovering(harness);

    const response = await giveTotp(
      harness,
      await challenged(harness, user),
      wrongTotpCode(user.totpUri),
    );

    expect(response.status).toBe(401);
    expect(await recoveriesOf(user.userId)).toHaveLength(1);
  });

  test('a new password cancels it: it is what the e-mail tells someone who asked nothing to do', async () => {
    const harness = testApp();
    const user = await recovering(harness);
    await postJson(harness.app, '/api/password-reset', { email: user.email });
    const link = (await harness.emails()).findLast(
      (message) => message.to === user.email && message.text.includes('/reset-password#'),
    );
    const token = /\/reset-password#(\S+)/.exec(link?.text ?? '')?.[1];

    const response = await postJson(harness.app, '/api/password-reset/complete', {
      token,
      password: NEW_PASSWORD,
      code: totpCode(user.totpUri),
    });

    expect(response.status).toBe(200);
    expect(await recoveriesOf(user.userId)).toEqual([]);
  });

  test('after a new password, a sign-in begun with the old one asks for no recovery', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    // Someone who knows the password, awaited at the code.
    const challenge = await challenged(harness, user);
    await postJson(harness.app, '/api/password-reset', { email: user.email });
    const link = (await harness.emails()).findLast(
      (message) => message.to === user.email && message.text.includes('/reset-password#'),
    );
    const token = /\/reset-password#(\S+)/.exec(link?.text ?? '')?.[1];
    const reset = await postJson(harness.app, '/api/password-reset/complete', {
      token,
      password: NEW_PASSWORD,
      code: totpCode(user.totpUri),
    });
    expect(reset.status).toBe(200);

    const response = await requestRecovery(harness, challenge);

    expect(response.status).toBe(401);
    expect(await recoveriesOf(user.userId)).toEqual([]);
  });

  test('turning the second factor off by hand ends it: a new one is not turned off in its place', async () => {
    const harness = longAgo();
    const user = await recovering(harness);
    const disabled = await postJson(
      harness.app,
      '/api/account/two-factor/disable',
      { password: user.password },
      user.cookie,
    );
    expect(disabled.status).toBe(204);

    expect(await recoveriesOf(user.userId)).toEqual([]);
  });
});

describe('the deadlines of a recovery', () => {
  test('a reminder leaves the day before, once, with a link to cancel of its own', async () => {
    const harness = longAgo();
    const user = await recovering(harness, { timeZone: 'Europe/Paris' });
    const firstToken = await cancelToken(harness, user.email);

    harness.clock.advance('P5DT23H59M');
    await runDeadlines(harness);
    expect(await emailsTo(harness, user.email, REMINDER_SUBJECTS)).toEqual([]);

    harness.clock.advance('PT1M');
    await runDeadlines(harness);
    await runDeadlines(harness);
    const [reminder, ...others] = await emailsTo(harness, user.email, REMINDER_SUBJECTS);
    expect(others).toEqual([]);
    expect(reminder?.text).toContain('10 mars 2025 à 10:00 UTC+1');
    expect(await codeAsked(harness, user)).toBe(true);

    const token = await cancelToken(harness, user.email, REMINDER_SUBJECTS);
    expect(token).not.toBe(firstToken);
    expect((await cancelRecovery(harness, token)).status).toBe(204);
    expect(await recoveriesOf(user.userId)).toEqual([]);
  });

  test('the link of the first e-mail still cancels after the reminder', async () => {
    const harness = longAgo();
    const user = await recovering(harness);
    const token = await cancelToken(harness, user.email);
    harness.clock.advance('P6D');
    await runDeadlines(harness);
    expect(await emailsTo(harness, user.email, REMINDER_SUBJECTS)).toHaveLength(1);

    expect((await cancelRecovery(harness, token)).status).toBe(204);
  });

  test('after 7 days the second factor is off, and an e-mail says so', async () => {
    const harness = longAgo();
    const user = await recovering(harness);

    harness.clock.advance('P6DT23H59M');
    await runDeadlines(harness);
    expect(await codeAsked(harness, user)).toBe(true);
    expect(await emailsTo(harness, user.email, COMPLETED_SUBJECTS)).toEqual([]);

    harness.clock.advance('PT1M');
    await runDeadlines(harness);
    await runDeadlines(harness);

    // The password alone signs in again.
    const response = await signIn(harness, user.email, user.password);
    expect(await response.json()).toEqual({ email: user.email });
    const status = await harness.app.request('/api/account/two-factor', {
      headers: { Cookie: cookiesOf(response) },
    });
    expect(await status.json()).toEqual({ enabled: false });
    const [completed, ...others] = await emailsTo(harness, user.email, COMPLETED_SUBJECTS);
    expect(others).toEqual([]);
    expect(completed?.text).toContain('https://app.battlecrm.test/forgot-password');
    expect(await recoveriesOf(user.userId)).toEqual([]);
    // The link to cancel has nothing left to cancel.
    const token = await cancelToken(harness, user.email);
    expect((await cancelRecovery(harness, token)).status).toBe(400);
  });

  test('once off, the second factor can be turned on again and stays on', async () => {
    const harness = longAgo();
    const user = await recovering(harness);
    harness.clock.advance('P7D');
    await runDeadlines(harness);
    const signedIn = await signIn(harness, user.email, user.password);
    const cookie = cookiesOf(signedIn);
    const start = await postJson(
      harness.app,
      '/api/account/two-factor',
      { password: user.password },
      cookie,
    );
    const { totpUri } = z.object({ totpUri: z.string() }).parse(await start.json());
    const confirmed = await postJson(
      harness.app,
      '/api/account/two-factor/confirm',
      { password: user.password, code: totpCode(totpUri) },
      cookie,
    );
    expect(confirmed.status).toBe(200);

    harness.clock.advance('P7D');
    await runDeadlines(harness);

    expect(await codeAsked(harness, user)).toBe(true);
  });

  test('a failed e-mail does not bring the step back', async () => {
    const harness = longAgo();
    const user: Protected = await recovering(harness);
    harness.clock.advance('P6D');
    harness.email.failWith = new Error('SMTP down');

    await runDeadlines(harness);
    await harness.emails();
    harness.email.failWith = undefined;
    await runDeadlines(harness);

    // Marked in the transaction, sent after it: no retry (spec stack §8).
    expect(await emailsTo(harness, user.email, REMINDER_SUBJECTS)).toEqual([]);
    expect((await recoveriesOf(user.userId))[0]?.remindedAt).toEqual(harness.clock.now());
  });
});
