import { randomUUID } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import { BREACHED_PASSWORD, GOOD_PASSWORD, testApp } from '../../test/app.ts';
import { testBetterAuth } from '../../test/better-auth.ts';
import { makeUser, verificationToken } from '../../test/factories/user.ts';
import { cookiesOf, postJson } from '../../test/http.ts';

const newEmail = () => `jane-${randomUUID()}@example.com`;

function signUp(
  harness: ReturnType<typeof testApp>,
  overrides: Partial<{ email: string; password: string; locale: string; timeZone: string }> = {},
) {
  return postJson(harness.app, '/api/signup', {
    email: newEmail(),
    password: GOOD_PASSWORD,
    locale: 'fr',
    timeZone: 'Europe/Paris',
    ...overrides,
  });
}

/** Signs up and returns the id of the attempt, which “Resend the link” names. */
async function startAttempt(harness: ReturnType<typeof testApp>, email: string) {
  const body: unknown = await (await signUp(harness, { email })).json();
  if (typeof body === 'object' && body !== null && 'attemptId' in body) {
    return String(body.attemptId);
  }
  throw new Error('The sign-up returned no attempt');
}

const resend = (harness: ReturnType<typeof testApp>, attemptId: unknown) =>
  postJson(harness.app, '/api/signup/resend', { attemptId });

const click = (harness: ReturnType<typeof testApp>, token: string) =>
  postJson(harness.app, '/api/signup/verify', { token });

const session = (harness: ReturnType<typeof testApp>, cookie?: string) =>
  harness.app.request('/api/session', cookie === undefined ? {} : { headers: { Cookie: cookie } });

describe('signing up', () => {
  test('answers 202 and sends the verification link in the language of the attempt', async () => {
    const harness = testApp();
    const french = newEmail();
    const english = newEmail();

    const response = await signUp(harness, { email: french, locale: 'fr' });
    await signUp(harness, { email: english, locale: 'en' });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ attemptId: expect.stringMatching(/^[\da-f-]{36}$/) });
    const emails = await harness.emails();
    expect(emails.map(({ to, subject }) => ({ to, subject }))).toEqual([
      { to: french, subject: 'Confirme ton adresse e-mail' },
      { to: english, subject: 'Confirm your email address' },
    ]);
    expect(emails[0]?.text).toMatch(/https:\/\/app\.battlecrm\.test\/verify-email#[\w-]{43}/);
  });

  test('opens no session: the account does not exist before the click', async () => {
    const harness = testApp();

    const response = await signUp(harness);

    expect(response.headers.getSetCookie()).toEqual([]);
  });

  test('the address is trimmed and lower-cased', async () => {
    const harness = testApp();
    const email = newEmail();

    await signUp(harness, { email: `  ${email.toUpperCase()} ` });

    expect((await harness.emails()).map(({ to }) => to)).toEqual([email]);
  });

  test('accepts 15 to 128 characters and no other rule', async () => {
    const harness = testApp();

    expect((await signUp(harness, { password: 'a'.repeat(14) })).status).toBe(400);
    expect((await signUp(harness, { password: 'a'.repeat(15) })).status).toBe(202);
    expect((await signUp(harness, { password: `${' '.repeat(127)}a` })).status).toBe(202);
    expect((await signUp(harness, { password: 'a'.repeat(129) })).status).toBe(400);
  });

  test('refuses anything that is not a sign-up', async () => {
    const harness = testApp();

    expect((await signUp(harness, { email: 'not an address' })).status).toBe(400);
    expect((await signUp(harness, { locale: 'de' })).status).toBe(400);
    expect((await postJson(harness.app, '/api/signup', 'not json')).status).toBe(400);
    expect(await harness.emails()).toEqual([]);
  });

  test('refuses a password known to have leaked, without sending anything', async () => {
    const harness = testApp();

    const response = await signUp(harness, { password: BREACHED_PASSWORD });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'password_compromised' });
    expect(await harness.emails()).toEqual([]);
  });

  test('refuses every password while Have I Been Pwned is unreachable', async () => {
    const harness = testApp();
    harness.hibp.unreachable = true;

    const response = await signUp(harness);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'password_check_unavailable' });
    expect(await harness.emails()).toEqual([]);
    expect(harness.alert.downs).toEqual([]);
  });

  test('logs neither the address, nor the password, nor the token', async () => {
    const harness = testApp();
    const email = newEmail();

    await signUp(harness, { email });
    const token = await verificationToken(harness, email);
    await click(harness, token);

    expect(harness.output()).not.toContain(email);
    expect(harness.output()).not.toContain(GOOD_PASSWORD);
    expect(harness.output()).not.toContain(token);
  });
});

describe('a request forged from another site', () => {
  test('cannot sign up nor click a link: only same-origin JSON reaches these routes', async () => {
    const harness = testApp();
    const email = newEmail();
    await signUp(harness, { email });
    const token = await verificationToken(harness, email);
    // What a cross-site page can send without a CORS preflight: a "simple" content type.
    const forged = (path: string, body: unknown, origin?: string) =>
      harness.app.request(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          ...(origin === undefined ? {} : { Origin: origin }),
        },
        body: JSON.stringify(body),
      });
    const attempt = { email: newEmail(), password: GOOD_PASSWORD, locale: 'fr', timeZone: 'UTC' };

    expect((await forged('/api/signup', attempt, 'https://evil.example')).status).toBe(403);
    expect((await forged('/api/signup/verify', { token }, 'https://evil.example')).status).toBe(
      403,
    );
    expect((await forged('/api/signup/verify', { token })).status).not.toBe(200);
    expect(await harness.emails()).toHaveLength(1);
    expect((await click(harness, token)).status).toBe(200);
  });
});

describe('clicking the link', () => {
  test('creates the account and opens a 90-day session on this device', async () => {
    const harness = testApp();
    const email = newEmail();
    await signUp(harness, { email });

    const response = await click(harness, await verificationToken(harness, email));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email });
    const [cookie, ...others] = response.headers.getSetCookie();
    expect(others).toEqual([]);
    expect(cookie).toMatch(/^__Secure-battlecrm\.session_token=[^;]+;/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain(`Max-Age=${90 * 24 * 60 * 60}`);

    const signedIn = await session(harness, cookiesOf(response));
    expect(signedIn.status).toBe(200);
    expect(await signedIn.json()).toEqual({ email });
  });

  test('the session is one Better Auth itself recognises, with the device that clicked', async () => {
    const harness = testApp();
    const email = newEmail();
    await signUp(harness, { email });

    const response = await harness.app.request('/api/signup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Firefox on Linux' },
      body: JSON.stringify({ token: await verificationToken(harness, email) }),
    });

    const auth = await testBetterAuth();
    const known = await auth.api.getSession({
      headers: new Headers({ Cookie: cookiesOf(response) }),
    });
    expect(known?.user).toMatchObject({ email, emailVerified: true });
    expect(known?.session.userAgent).toBe('Firefox on Linux');
    const days = (known!.session.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(90);
  });

  test('works once', async () => {
    const harness = testApp();
    const email = newEmail();
    await signUp(harness, { email });
    const token = await verificationToken(harness, email);
    await click(harness, token);

    const again = await click(harness, token);

    expect(again.status).toBe(400);
    expect(await again.json()).toEqual({ error: 'invalid_link' });
    expect(again.headers.getSetCookie()).toEqual([]);
  });

  test('works for 24 hours, not a second more', async () => {
    const harness = testApp();
    const [late, inTime] = [newEmail(), newEmail()];
    await signUp(harness, { email: late });
    await signUp(harness, { email: inTime });
    const tokens = [
      await verificationToken(harness, late),
      await verificationToken(harness, inTime),
    ];

    harness.clock.advance('PT23H59M59S');
    expect((await click(harness, tokens[1]!)).status).toBe(200);
    harness.clock.advance('PT1S');
    expect((await click(harness, tokens[0]!)).status).toBe(400);
  });

  test('refuses a token nobody was sent', async () => {
    const harness = testApp();

    expect((await click(harness, 'made-up')).status).toBe(400);
    expect((await postJson(harness.app, '/api/signup/verify', {})).status).toBe(400);
  });

  test('the account takes the password of the attempt clicked; the other attempts die', async () => {
    const harness = testApp();
    const email = newEmail();
    await signUp(harness, { email, password: 'the password of somebody else' });
    const first = await verificationToken(harness, email);
    harness.clock.advance('PT1M');
    await signUp(harness, { email, password: GOOD_PASSWORD });
    const second = await verificationToken(harness, email);

    expect((await click(harness, second)).status).toBe(200);
    expect((await click(harness, first)).status).toBe(400);

    const auth = await testBetterAuth();
    const context = await auth.$context;
    const user = await context.internalAdapter.findUserByEmail(email, { includeAccounts: true });
    const hash = user?.accounts[0]?.password ?? '';
    expect(user?.accounts).toHaveLength(1);
    expect(await context.password.verify({ hash, password: GOOD_PASSWORD })).toBe(true);
    expect(await context.password.verify({ hash, password: 'the password of somebody else' })).toBe(
      false,
    );
  });
});

describe('an address that already has an account', () => {
  test('gets the same answer, and the e-mail “you already have an account” in the language asked', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    const before = (await harness.emails()).length;

    const response = await signUp(harness, { email, locale: 'en' });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ attemptId: expect.stringMatching(/^[\da-f-]{36}$/) });
    expect(response.headers.getSetCookie()).toEqual([]);
    const [sent, ...others] = (await harness.emails()).slice(before);
    expect(others).toEqual([]);
    expect(sent).toMatchObject({ to: email, subject: 'You already have an account' });
    expect(sent?.text).toContain('https://app.battlecrm.test/sign-in');
    expect(sent?.text).toContain('https://app.battlecrm.test/forgot-password');
    expect(sent?.text).not.toContain('/verify-email');
  });

  test('an attempt started before the account existed can no longer be clicked', async () => {
    const harness = testApp();
    const email = newEmail();
    await signUp(harness, { email, password: 'the password of an early attacker' });
    const early = await verificationToken(harness, email);
    harness.clock.advance('PT1M');
    await signUp(harness, { email });
    await click(harness, await verificationToken(harness, email));
    await signUp(harness, { email, password: 'another password of the attacker' });

    expect((await click(harness, early)).status).toBe(400);
  });
});

describe('“Resend the link”', () => {
  test('waits a minute, then sends a new link for the same attempt, which replaces the previous one', async () => {
    const harness = testApp();
    const email = newEmail();
    const attemptId = await startAttempt(harness, email);
    const first = await verificationToken(harness, email);

    harness.clock.advance('PT59S');
    const tooSoon = await resend(harness, attemptId);
    expect(tooSoon.status).toBe(429);
    expect(await tooSoon.json()).toEqual({ error: 'too_soon', retryAfterSeconds: 1 });
    expect(await harness.emails()).toHaveLength(1);

    harness.clock.advance('PT1S');
    expect((await resend(harness, attemptId)).status).toBe(204);
    expect(await harness.emails()).toHaveLength(2);
    const second = await verificationToken(harness, email);
    expect(second).not.toBe(first);
    expect((await click(harness, first)).status).toBe(400);
    expect((await click(harness, second)).status).toBe(200);
  });

  test('gives the new link its own 24 hours', async () => {
    const harness = testApp();
    const email = newEmail();
    const attemptId = await startAttempt(harness, email);

    harness.clock.advance('PT23H');
    await resend(harness, attemptId);
    harness.clock.advance('PT23H');

    expect((await click(harness, await verificationToken(harness, email))).status).toBe(200);
  });

  test('answers alike for an attempt that does not exist, and sends nothing', async () => {
    const harness = testApp();

    expect((await resend(harness, randomUUID())).status).toBe(204);
    expect((await resend(harness, 'not-an-id')).status).toBe(400);
    expect(await harness.emails()).toEqual([]);
  });

  test('sends “you already have an account” again to a taken address', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    const attemptId = await startAttempt(harness, email);
    const before = (await harness.emails()).length;

    harness.clock.advance('PT1M');
    expect((await resend(harness, attemptId)).status).toBe(204);

    expect((await harness.emails()).slice(before).map(({ subject }) => subject)).toEqual([
      'Tu as déjà un compte',
    ]);
  });
});

describe('the delay between two sends', () => {
  test('holds per address: signing up again within a minute answers alike and sends nothing', async () => {
    const harness = testApp();
    const email = newEmail();
    await signUp(harness, { email });

    harness.clock.advance('PT59S');
    const again = await signUp(harness, { email });

    expect(again.status).toBe(202);
    expect(await again.json()).toEqual({ attemptId: expect.stringMatching(/^[\da-f-]{36}$/) });
    expect(await harness.emails()).toHaveLength(1);

    harness.clock.advance('PT1M');
    await signUp(harness, { email });
    expect(await harness.emails()).toHaveLength(2);
  });

  test('a click on an expired link leaves the attempt alone: resending revives it', async () => {
    const harness = testApp();
    const email = newEmail();
    const attemptId = await startAttempt(harness, email);
    const expired = await verificationToken(harness, email);
    harness.clock.advance('P1D');

    expect((await click(harness, expired)).status).toBe(400);
    expect((await resend(harness, attemptId)).status).toBe(204);

    expect(await harness.emails()).toHaveLength(2);
    expect((await click(harness, await verificationToken(harness, email))).status).toBe(200);
  });
});

describe('SIGNUPS_OPEN', () => {
  test('GET /api/config tells the SPA whether sign-ups are open', async () => {
    const open = await testApp().app.request('/api/config');
    const closed = await testApp({ SIGNUPS_OPEN: 'false' }).app.request('/api/config');

    expect(await open.json()).toEqual({ signupsOpen: true });
    expect(await closed.json()).toEqual({ signupsOpen: false });
  });

  test('closed, a sign-up is refused and sends nothing', async () => {
    const harness = testApp({ SIGNUPS_OPEN: 'false' });

    const response = await signUp(harness);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'signups_closed' });
    expect(await harness.emails()).toEqual([]);
  });

  test('an attempt started before the door closed can still be resent and verified', async () => {
    const open = testApp();
    const email = newEmail();
    const attemptId = await startAttempt(open, email);
    const closed = testApp({ SIGNUPS_OPEN: 'false' });

    closed.clock.advance('PT1M');
    expect((await postJson(closed.app, '/api/signup/resend', { attemptId })).status).toBe(204);
    const response = await click(closed, await verificationToken(closed, email));

    expect(response.status).toBe(200);
    expect((await session(closed, cookiesOf(response))).status).toBe(200);
  });
});

describe('the purge job', () => {
  test('erases the attempts never verified after 7 days, and only those', async () => {
    const harness = testApp();
    const [old, recent] = [newEmail(), newEmail()];
    await signUp(harness, { email: old });
    harness.clock.advance('P6DT23H');
    await signUp(harness, { email: recent });
    const attemptId = await startAttempt(harness, old);
    harness.clock.advance('PT1H1S');

    for (const job of harness.jobs) await job.run();

    // The oldest attempt is gone: its link is dead even after a fresh 24 hours would have been granted.
    expect((await click(harness, await firstToken(harness, old))).status).toBe(400);
    expect((await postJson(harness.app, '/api/signup/resend', { attemptId })).status).toBe(204);
    expect((await click(harness, await verificationToken(harness, old))).status).toBe(200);
    expect((await click(harness, await verificationToken(harness, recent))).status).toBe(200);
  });
});

async function firstToken(harness: ReturnType<typeof testApp>, email: string) {
  const sent = (await harness.emails()).find((message) => message.to === email);
  return /\/verify-email#(\S+)/.exec(sent?.text ?? '')?.[1] ?? '';
}

describe('GET /api/session', () => {
  test('answers 401 without a session, or with a cookie nobody signed', async () => {
    const harness = testApp();
    const { cookie } = await makeUser(harness);
    const [name, value = ''] = cookie.split('=');
    const forged = `${name}=${value.replace(/^.{4}/, 'AAAA')}`;

    expect((await session(harness)).status).toBe(401);
    expect((await session(harness, forged)).status).toBe(401);
    expect((await session(harness, cookie)).status).toBe(200);
  });

  test('the request log names the User', async () => {
    const harness = testApp();
    const { cookie, userId } = await makeUser(harness);

    await session(harness, cookie);

    expect(harness.logs().at(-1)).toMatchObject({ route: '/api/session', status: 200, userId });
  });
});
