import { createHash } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { makeUser } from '../../test/factories/user.ts';
import { cookiesOf, DEVICE_COOKIE, deviceCookie, postJson } from '../../test/http.ts';
import { withoutIsolation } from '../db/index.ts';
import { knownDevice, session } from './tables.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const FIREFOX_ON_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0';
const SAFARI_ON_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

/** A sign-in from a browser that kept these cookies: none is a device never seen. */
const signIn = (harness: Harness, { email, password }: User, cookie?: string, userAgent?: string) =>
  postJson(
    harness.app,
    '/api/auth/sign-in/email',
    { email, password },
    cookie,
    userAgent === undefined ? {} : { userAgent },
  );

const signOut = (harness: Harness, cookie: string) =>
  postJson(harness.app, '/api/auth/sign-out', {}, cookie);

const whoAmI = (harness: Harness, cookie: string) =>
  harness.app.request('/api/session', { headers: { Cookie: cookie } });

/** The security e-mails "new device" sent to an address. */
async function newDeviceEmails(harness: Harness, email: string) {
  const subjects = [
    'Nouvelle connexion à ton compte BattleCRM',
    'New sign-in to your BattleCRM account',
  ];
  return (await harness.emails()).filter(
    (message) => message.to === email && subjects.includes(message.subject),
  );
}

const sessionList = z.object({
  sessions: z.array(
    z.strictObject({
      id: z.uuid(),
      browser: z.string().nullable(),
      os: z.string().nullable(),
      lastActiveAt: z.iso.datetime(),
      current: z.boolean(),
    }),
  ),
});

async function listSessions(harness: Harness, cookie: string) {
  const response = await harness.app.request('/api/sessions', { headers: { Cookie: cookie } });
  expect(response.status).toBe(200);
  return sessionList.parse(await response.json()).sessions;
}

const revoke = (harness: Harness, cookie: string, id: string) =>
  postJson(harness.app, `/api/sessions/${id}/revoke`, {}, cookie);

const revokeOthers = (harness: Harness, cookie: string) =>
  postJson(harness.app, '/api/sessions/revoke-others', {}, cookie);

describe('the device cookie', () => {
  test('is set by the click that creates the account, one per device', async () => {
    const harness = testApp();

    const first = await makeUser(harness);
    const second = await makeUser(harness);

    expect(deviceCookie(first.cookie)).toMatch(/^__Host-battlecrm\.device=[\w-]{43}$/);
    expect(deviceCookie(second.cookie)).not.toBe(deviceCookie(first.cookie));
  });

  test('is random, long-lived and out of reach of the page', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    const response = await signIn(harness, user);

    const cookie =
      response.headers.getSetCookie().find((line) => line.startsWith(`${DEVICE_COOKIE}=`)) ?? '';
    expect(cookie).toMatch(/^__Host-battlecrm\.device=[\w-]{43};/);
    expect(cookie).toContain(`Max-Age=${400 * 24 * 60 * 60}`);
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Domain');
  });

  test('only its fingerprint is kept, in `known_device`', async () => {
    const harness = testApp();

    const { userId, cookie } = await makeUser(harness);

    const value = deviceCookie(cookie).slice(DEVICE_COOKIE.length + 1);
    const devices = await withoutIsolation((db) =>
      db.select().from(knownDevice).where(eq(knownDevice.userId, userId)),
    );
    expect(devices.map((device) => device.tokenHash)).toEqual([
      createHash('sha256').update(value).digest('hex'),
    ]);
    expect(JSON.stringify(devices)).not.toContain(value);
  });

  test('survives signing out', async () => {
    const harness = testApp();
    const { cookie } = await makeUser(harness);

    const response = await signOut(harness, cookie);

    expect(response.headers.getSetCookie().join('\n')).not.toContain(DEVICE_COOKIE);
  });

  test('a failed sign-in sets none', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    const response = await signIn(harness, { ...user, password: 'not the right password' });

    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe('signing in from a device', () => {
  test('never seen: the User gets a security e-mail that names it, with “It was not me”', async () => {
    const harness = testApp();
    const user = await makeUser(harness, { locale: 'fr', timeZone: 'Europe/Paris' });

    const response = await signIn(harness, user, undefined, FIREFOX_ON_LINUX);

    expect(response.status).toBe(200);
    const [email, ...others] = await newDeviceEmails(harness, user.email);
    expect(others).toEqual([]);
    // 09:00 UTC on the test clock is 10:00 in Paris.
    expect(email?.text).toContain('Firefox · Linux · 5 janvier 2026 à 10:00 UTC+1');
    expect(email?.text).toContain("Ce n'était pas moi\nhttps://app.battlecrm.test/forgot-password");
    expect(email?.html).toContain('href="https://app.battlecrm.test/forgot-password"');
  });

  test('never seen: the e-mail speaks the language of the User, in their time zone', async () => {
    const harness = testApp();
    const user = await makeUser(harness, { locale: 'en', timeZone: 'America/New_York' });

    await signIn(harness, user, undefined, SAFARI_ON_IPHONE);

    const [email] = await newDeviceEmails(harness, user.email);
    expect(email?.subject).toBe('New sign-in to your BattleCRM account');
    expect(email?.text).toContain('Safari · iOS · January 5, 2026 at 4:00 AM EST');
    expect(email?.text).toContain("It wasn't me\nhttps://app.battlecrm.test/forgot-password");
  });

  test('never seen, which says nothing of itself: the e-mail says so', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    await signIn(harness, user);

    const [email] = await newDeviceEmails(harness, user.email);
    expect(email?.text).toContain('Navigateur inconnu · Système inconnu · 5 janvier 2026');
  });

  test('never seen: it gets its own cookie, and is known from then on', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const first = await signIn(harness, user);
    const device = deviceCookie(cookiesOf(first));
    expect(device).not.toBe('');
    expect(device).not.toBe(deviceCookie(user.cookie));
    await signOut(harness, cookiesOf(first));

    const again = await signIn(harness, user, device);

    expect(again.status).toBe(200);
    expect(await newDeviceEmails(harness, user.email)).toHaveLength(1);
  });

  test('already known: no e-mail, even after signing out, and its cookie lasts longer', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    await signOut(harness, user.cookie);

    const response = await signIn(harness, user, deviceCookie(user.cookie));

    expect(response.status).toBe(200);
    expect(await newDeviceEmails(harness, user.email)).toEqual([]);
    expect(deviceCookie(cookiesOf(response))).toBe(deviceCookie(user.cookie));
  });

  test('the first session of the account sends nothing', async () => {
    const harness = testApp();

    const user = await makeUser(harness);

    expect(await newDeviceEmails(harness, user.email)).toEqual([]);
  });

  test('an account that never had a device sends nothing for its first one', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    // An account older than the device cookie.
    await withoutIsolation((db) =>
      db.delete(knownDevice).where(eq(knownDevice.userId, user.userId)),
    );

    await signIn(harness, user);
    await signIn(harness, user);

    expect(await newDeviceEmails(harness, user.email)).toHaveLength(1);
  });

  test('known to another account: it is new to this one, and keeps its cookie', async () => {
    const harness = testApp();
    const owner = await makeUser(harness);
    const guest = await makeUser(harness);
    const device = deviceCookie(owner.cookie);

    const response = await signIn(harness, guest, device);

    expect(await newDeviceEmails(harness, guest.email)).toHaveLength(1);
    expect(await newDeviceEmails(harness, owner.email)).toEqual([]);
    expect(deviceCookie(cookiesOf(response))).toBe(device);
    await signIn(harness, owner, device);
    expect(await newDeviceEmails(harness, owner.email)).toEqual([]);
  });

  test('a cookie nobody issued is a device never seen', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    await signIn(harness, user, `${DEVICE_COOKIE}=forged`);

    expect(await newDeviceEmails(harness, user.email)).toHaveLength(1);
  });

  test('a wrong password sends nothing', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    await signIn(harness, { ...user, password: 'not the right password' });

    expect(await newDeviceEmails(harness, user.email)).toEqual([]);
  });

  test('sign-ins sent together from one new device send one e-mail', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const device = `${DEVICE_COOKIE}=${'a'.repeat(43)}`;

    await Promise.all([signIn(harness, user, device), signIn(harness, user, device)]);

    expect(await newDeviceEmails(harness, user.email)).toHaveLength(1);
  });
});

describe('connected devices', () => {
  test('lists the sessions of the User: browser, system, last activity, this device first', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const phone = cookiesOf(await signIn(harness, user, undefined, SAFARI_ON_IPHONE));
    const laptop = cookiesOf(await signIn(harness, user, undefined, FIREFOX_ON_LINUX));

    const sessions = await listSessions(harness, laptop);

    expect(sessions.map(({ browser, os, current }) => ({ browser, os, current }))).toEqual([
      { browser: 'Firefox', os: 'Linux', current: true },
      { browser: 'Safari', os: 'iOS', current: false },
      { browser: null, os: null, current: false },
    ]);
    for (const { lastActiveAt } of sessions) {
      expect(Math.abs(Date.now() - new Date(lastActiveAt).getTime())).toBeLessThan(60_000);
    }
    expect(
      (await listSessions(harness, phone)).map(({ os, current }) => ({ os, current })),
    ).toEqual([
      { os: 'iOS', current: true },
      { os: 'Linux', current: false },
      { os: null, current: false },
    ]);
  });

  test('never shows a session token, nor the sessions of another User', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    await makeUser(harness);

    const response = await harness.app.request('/api/sessions', {
      headers: { Cookie: user.cookie },
    });

    const token = /session_token=([^.;]+)/.exec(user.cookie)?.[1] ?? '';
    expect(token).not.toBe('');
    const body = await response.text();
    expect(body).not.toContain(token);
    expect(sessionList.parse(JSON.parse(body)).sessions).toHaveLength(1);
  });

  test('leaves out a session that has expired and was not purged yet', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    await signIn(harness, user);
    const [current, other] = await listSessions(harness, user.cookie);
    await withoutIsolation((db) =>
      db
        .update(session)
        .set({ expiresAt: new Date(harness.clock.now().getTime() - 1000) })
        .where(eq(session.id, other?.id ?? '')),
    );

    expect(await listSessions(harness, user.cookie)).toEqual([current]);
  });

  test('“Sign out” on one: that device answers 401 at once, the others stay signed in', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const phone = cookiesOf(await signIn(harness, user, undefined, SAFARI_ON_IPHONE));
    const tablet = cookiesOf(await signIn(harness, user));
    const lost = (await listSessions(harness, user.cookie)).find(({ os }) => os === 'iOS');

    const response = await revoke(harness, user.cookie, lost?.id ?? '');

    expect(response.status).toBe(204);
    const revoked = await whoAmI(harness, phone);
    expect(revoked.status).toBe(401);
    expect(await revoked.json()).toEqual({ error: 'unauthenticated' });
    expect(
      (await harness.app.request('/api/sessions', { headers: { Cookie: phone } })).status,
    ).toBe(401);
    expect((await whoAmI(harness, tablet)).status).toBe(200);
    expect((await whoAmI(harness, user.cookie)).status).toBe(200);
    expect(await listSessions(harness, user.cookie)).toHaveLength(2);
  });

  test('“Sign out” asks for no password and sends no e-mail', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    await signIn(harness, user, deviceCookie(user.cookie));
    const [, other] = await listSessions(harness, user.cookie);
    const before = (await harness.emails()).length;

    expect((await revoke(harness, user.cookie, other?.id ?? '')).status).toBe(204);

    expect((await harness.emails()).length).toBe(before);
  });

  test('the session of another User cannot be ended, nor told from one that does not exist', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const stranger = await makeUser(harness);
    const [theirs] = await listSessions(harness, stranger.cookie);

    const response = await revoke(harness, user.cookie, theirs?.id ?? '');
    const unknown = await revoke(harness, user.cookie, '00000000-0000-7000-8000-000000000000');

    for (const answer of [response, unknown]) {
      expect(answer.status).toBe(404);
      expect(await answer.json()).toEqual({ error: 'not_found' });
    }
    expect((await whoAmI(harness, stranger.cookie)).status).toBe(200);
  });

  test('this device is not ended that way: signing out does it, and erases its cookie', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const [current] = await listSessions(harness, user.cookie);

    const response = await revoke(harness, user.cookie, current?.id ?? '');

    expect(response.status).toBe(404);
    expect((await whoAmI(harness, user.cookie)).status).toBe(200);
  });

  test('an id that is not one is refused', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    expect((await revoke(harness, user.cookie, 'not-an-id')).status).toBe(400);
  });

  test('“Sign out all the others” keeps this device only, and leaves the other Users alone', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const stranger = await makeUser(harness);
    const phone = cookiesOf(await signIn(harness, user));
    const tablet = cookiesOf(await signIn(harness, user));

    const response = await revokeOthers(harness, phone);

    expect(response.status).toBe(204);
    expect((await whoAmI(harness, phone)).status).toBe(200);
    expect((await whoAmI(harness, tablet)).status).toBe(401);
    expect((await whoAmI(harness, user.cookie)).status).toBe(401);
    expect((await whoAmI(harness, stranger.cookie)).status).toBe(200);
    expect(await listSessions(harness, phone)).toHaveLength(1);
  });

  test('a device signed out from elsewhere is still known when it signs in again', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const phone = await signIn(harness, user);
    await revokeOthers(harness, user.cookie);

    await signIn(harness, user, deviceCookie(cookiesOf(phone)));

    expect(await newDeviceEmails(harness, user.email)).toHaveLength(1);
  });
});
