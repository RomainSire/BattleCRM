import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';

import { BREACHED_PASSWORD, testApp } from '../../test/app.ts';
import { makeUser } from '../../test/factories/user.ts';
import { cookiesOf, deviceCookie, postJson } from '../../test/http.ts';
import { withoutIsolation } from '../db/index.ts';
import { verification } from './tables.ts';

type Harness = ReturnType<typeof testApp>;

const NEW_PASSWORD = 'a brand new passphrase';
const LINK_SUBJECTS = ['Réinitialise ton mot de passe', 'Reset your password'];
const CHANGED_SUBJECTS = ['Ton mot de passe a été modifié', 'Your password was changed'];

const askFor = (harness: Harness, email: unknown) =>
  postJson(harness.app, '/api/password-reset', { email });

const complete = (harness: Harness, body: unknown, cookie?: string) =>
  postJson(harness.app, '/api/password-reset/complete', body, cookie);

const signIn = (harness: Harness, email: string, password: string, cookie?: string) =>
  postJson(harness.app, '/api/auth/sign-in/email', { email, password }, cookie);

const whoAmI = (harness: Harness, cookie: string) =>
  harness.app.request('/api/session', { headers: { Cookie: cookie } });

async function emailsTo(harness: Harness, email: string, subjects: string[]) {
  return (await harness.emails()).filter(
    (message) => message.to === email && subjects.includes(message.subject),
  );
}

/** Asks for a link and reads its token in the e-mail, as the User would click it. */
async function resetToken(harness: Harness, email: string): Promise<string> {
  expect((await askFor(harness, email)).status).toBe(204);
  const sent = (await emailsTo(harness, email, LINK_SUBJECTS)).at(-1);
  const token = sent && /\/reset-password#(\S+)/.exec(sent.text)?.[1];
  if (!token) throw new Error(`No reset link was sent to ${email}`);
  return token;
}

describe('asking for a reset link', () => {
  test('sends a single-use link of one hour, in the language of the User', async () => {
    const harness = testApp();
    const french = await makeUser(harness, { locale: 'fr' });
    const english = await makeUser(harness, { locale: 'en' });

    const response = await askFor(harness, french.email);
    await askFor(harness, english.email);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    const [inFrench, ...others] = await emailsTo(harness, french.email, LINK_SUBJECTS);
    expect(others).toEqual([]);
    expect(inFrench?.subject).toBe('Réinitialise ton mot de passe');
    expect(inFrench?.text).toMatch(/https:\/\/app\.battlecrm\.test\/reset-password#[\w-]{43}/);
    expect(inFrench?.text).toContain('1 heure');
    const [inEnglish] = await emailsTo(harness, english.email, LINK_SUBJECTS);
    expect(inEnglish?.subject).toBe('Reset your password');
  });

  test('an address without an account gets the very same answer, and no e-mail', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    const unknown = `nobody-${randomUUID()}@example.com`;

    const known = await askFor(harness, email);
    const nobody = await askFor(harness, unknown);

    expect(nobody.status).toBe(known.status);
    expect(await nobody.text()).toBe(await known.text());
    expect(nobody.headers.getSetCookie()).toEqual([]);
    expect((await harness.emails()).filter((message) => message.to === unknown)).toEqual([]);
  });

  test('the address is trimmed and lower-cased', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);

    await askFor(harness, `  ${email.toUpperCase()} `);

    expect(await emailsTo(harness, email, LINK_SUBJECTS)).toHaveLength(1);
  });

  test('keeps the fingerprint of the token only', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);

    const token = await resetToken(harness, email);

    const rows = await withoutIsolation((db) =>
      db.select().from(verification).where(eq(verification.value, email)),
    );
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  test('asked again within the minute, sends nothing more; the link already sent still works', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    const token = await resetToken(harness, email);

    harness.clock.advance('PT59S');
    const again = await askFor(harness, email);

    expect(again.status).toBe(204);
    expect(await emailsTo(harness, email, LINK_SUBJECTS)).toHaveLength(1);
    expect((await complete(harness, { token, password: NEW_PASSWORD })).status).toBe(200);
  });

  test('a minute later, a new link replaces the previous one', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    const first = await resetToken(harness, email);

    harness.clock.advance('PT1M');
    const second = await resetToken(harness, email);

    expect(second).not.toBe(first);
    expect((await complete(harness, { token: first, password: NEW_PASSWORD })).status).toBe(400);
    expect((await complete(harness, { token: second, password: NEW_PASSWORD })).status).toBe(200);
  });

  test('asked several times at once, sends a single link', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);

    await Promise.all(Array.from({ length: 5 }, async () => askFor(harness, email)));

    expect(await emailsTo(harness, email, LINK_SUBJECTS)).toHaveLength(1);
  });

  test('refuses anything that is not an address', async () => {
    const harness = testApp();

    expect((await askFor(harness, 'not an address')).status).toBe(400);
    expect((await askFor(harness, 42)).status).toBe(400);
    expect((await postJson(harness.app, '/api/password-reset', 'not json')).status).toBe(400);
  });

  test('logs neither the address nor the token', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);

    const token = await resetToken(harness, email);

    expect(harness.output()).not.toContain(email);
    expect(harness.output()).not.toContain(token);
  });
});

describe('the reset link', () => {
  test('sets the new password and signs this device in', async () => {
    const harness = testApp();
    const { email, password, userId } = await makeUser(harness);
    const token = await resetToken(harness, email);

    const response = await complete(harness, { token, password: NEW_PASSWORD });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email });
    const [cookie = ''] = response.headers.getSetCookie();
    expect(cookie).toMatch(/^__Secure-battlecrm\.session_token=[^;]+;/);
    expect(cookie).toContain(`Max-Age=${90 * 24 * 60 * 60}`);
    expect(cookie).toContain('HttpOnly');
    expect(await (await whoAmI(harness, cookiesOf(response))).json()).toEqual({ email });
    expect((await signIn(harness, email, password)).status).toBe(401);
    expect((await signIn(harness, email, NEW_PASSWORD)).status).toBe(200);
    expect(harness.logs()).toContainEqual(
      expect.objectContaining({ route: '/api/password-reset/complete', status: 200, userId }),
    );
    expect(harness.output()).not.toContain(NEW_PASSWORD);
  });

  test('signs every other device out', async () => {
    const harness = testApp();
    const { email, password, cookie } = await makeUser(harness);
    const otherDevice = cookiesOf(await signIn(harness, email, password));
    const token = await resetToken(harness, email);

    const response = await complete(harness, { token, password: NEW_PASSWORD });

    expect((await whoAmI(harness, cookie)).status).toBe(401);
    expect((await whoAmI(harness, otherDevice)).status).toBe(401);
    expect((await whoAmI(harness, cookiesOf(response))).status).toBe(200);
  });

  test('leaves the other Users alone', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    const other = await makeUser(harness);

    await complete(harness, { token: await resetToken(harness, email), password: NEW_PASSWORD });

    expect((await whoAmI(harness, other.cookie)).status).toBe(200);
    expect((await signIn(harness, other.email, other.password)).status).toBe(200);
  });

  test('works once', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    const token = await resetToken(harness, email);
    await complete(harness, { token, password: NEW_PASSWORD });

    const again = await complete(harness, { token, password: 'yet another passphrase' });

    expect(again.status).toBe(400);
    expect(await again.json()).toEqual({ error: 'invalid_link' });
    expect(again.headers.getSetCookie()).toEqual([]);
    expect((await signIn(harness, email, NEW_PASSWORD)).status).toBe(200);
  });

  test('sent twice at once, changes the password once', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    const token = await resetToken(harness, email);

    const responses = await Promise.all([
      complete(harness, { token, password: NEW_PASSWORD }),
      complete(harness, { token, password: 'yet another passphrase' }),
    ]);

    expect(responses.map((response) => response.status).toSorted((a, b) => a - b)).toEqual([
      200, 400,
    ]);
  });

  test('lasts one hour', async () => {
    const harness = testApp();
    const { email, password } = await makeUser(harness);
    const expired = await resetToken(harness, email);
    harness.clock.advance('PT1H');

    const tooLate = await complete(harness, { token: expired, password: NEW_PASSWORD });

    expect(tooLate.status).toBe(400);
    expect(await tooLate.json()).toEqual({ error: 'invalid_link' });
    expect((await signIn(harness, email, password)).status).toBe(200);

    const token = await resetToken(harness, email);
    harness.clock.advance('PT59M59S');
    expect((await complete(harness, { token, password: NEW_PASSWORD })).status).toBe(200);
  });

  test('a token nobody was sent is refused', async () => {
    const harness = testApp();

    const response = await complete(harness, { token: 'x'.repeat(43), password: NEW_PASSWORD });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_link' });
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  test('a password known to have leaked is refused, and the link still works', async () => {
    const harness = testApp();
    const { email, password } = await makeUser(harness);
    const token = await resetToken(harness, email);

    const refused = await complete(harness, { token, password: BREACHED_PASSWORD });

    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({ error: 'password_compromised' });
    expect(refused.headers.getSetCookie()).toEqual([]);
    expect((await signIn(harness, email, password)).status).toBe(200);
    expect((await complete(harness, { token, password: NEW_PASSWORD })).status).toBe(200);
  });

  test('a password that cannot be checked is refused, and the link still works', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    const token = await resetToken(harness, email);
    harness.hibp.unreachable = true;

    const refused = await complete(harness, { token, password: NEW_PASSWORD });

    expect(refused.status).toBe(503);
    expect(await refused.json()).toEqual({ error: 'password_check_unavailable' });
    harness.hibp.unreachable = false;
    expect((await complete(harness, { token, password: NEW_PASSWORD })).status).toBe(200);
  });

  test('a password judged on its length alone: 15 to 128 characters', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    const token = await resetToken(harness, email);

    expect((await complete(harness, { token, password: 'a'.repeat(14) })).status).toBe(400);
    expect((await complete(harness, { token, password: 'a'.repeat(129) })).status).toBe(400);
    expect((await complete(harness, { token })).status).toBe(400);
    expect((await complete(harness, { token, password: 'b'.repeat(128) })).status).toBe(200);
  });

  test('lifts the block of an address that failed too many sign-ins', async () => {
    const harness = testApp();
    const { email, password } = await makeUser(harness);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await signIn(harness, email, 'not the right password');
    }
    expect((await signIn(harness, email, password)).status).toBe(429);

    await complete(harness, { token: await resetToken(harness, email), password: NEW_PASSWORD });

    expect((await signIn(harness, email, NEW_PASSWORD)).status).toBe(200);
  });

  test('tells the User by e-mail, in their language, with “It was not me”', async () => {
    const harness = testApp();
    const french = await makeUser(harness, { locale: 'fr' });
    const english = await makeUser(harness, { locale: 'en' });

    for (const { email } of [french, english]) {
      await complete(harness, { token: await resetToken(harness, email), password: NEW_PASSWORD });
    }

    const [inFrench, ...others] = await emailsTo(harness, french.email, CHANGED_SUBJECTS);
    expect(others).toEqual([]);
    expect(inFrench?.subject).toBe('Ton mot de passe a été modifié');
    expect(inFrench?.text).toContain(
      "Ce n'était pas moi\nhttps://app.battlecrm.test/forgot-password",
    );
    expect(inFrench?.html).toContain('href="https://app.battlecrm.test/forgot-password"');
    const [inEnglish] = await emailsTo(harness, english.email, CHANGED_SUBJECTS);
    expect(inEnglish?.subject).toBe('Your password was changed');
  });

  test('a refused reset tells nobody', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    const token = await resetToken(harness, email);

    await complete(harness, { token, password: BREACHED_PASSWORD });

    expect(await emailsTo(harness, email, CHANGED_SUBJECTS)).toEqual([]);
  });

  test('from a device never seen: remembered, and worth no second e-mail', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    const newDeviceSubject = 'Nouvelle connexion à ton compte BattleCRM';

    const response = await complete(harness, {
      token: await resetToken(harness, email),
      password: NEW_PASSWORD,
    });
    const device = deviceCookie(cookiesOf(response));
    const signedInAgain = await signIn(harness, email, NEW_PASSWORD, device);

    expect(device).not.toBe('');
    expect(signedInAgain.status).toBe(200);
    expect(await emailsTo(harness, email, [newDeviceSubject])).toEqual([]);
  });
});
