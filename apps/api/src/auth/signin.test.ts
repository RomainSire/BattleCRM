import { randomUUID } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import { GOOD_PASSWORD, testApp } from '../../test/app.ts';
import { makeUser } from '../../test/factories/user.ts';
import { cookiesOf, postJson, randomIp } from '../../test/http.ts';

type Harness = ReturnType<typeof testApp>;

const unknownEmail = () => `nobody-${randomUUID()}@example.com`;

async function signIn(
  harness: Harness,
  credentials: { email: unknown; password: unknown },
  from?: { ip?: string },
) {
  return postJson(harness.app, '/api/auth/sign-in/email', credentials, undefined, from);
}

const signOut = (harness: Harness, cookie?: string) =>
  postJson(harness.app, '/api/auth/sign-out', {}, cookie);

const session = (harness: Harness, cookie: string) =>
  harness.app.request('/api/session', { headers: { Cookie: cookie } });

/** Wrong passwords, one after the other. */
async function fail(harness: Harness, email: string, times: number) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    const response = await signIn(harness, { email, password: 'not the right password' });
    expect(response.status).toBe(401);
  }
}

describe('signing in', () => {
  test('answers the address and opens a 90-day session on this device', async () => {
    const harness = testApp();
    const { email, password } = await makeUser(harness);

    const response = await signIn(harness, { email, password });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email });
    const [cookie = ''] = response.headers.getSetCookie();
    expect(cookie).toMatch(/^__Secure-battlecrm\.session_token=[^;]+;/);
    expect(cookie).toContain(`Max-Age=${90 * 24 * 60 * 60}`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    const signedIn = await session(harness, cookiesOf(response));
    expect(await signedIn.json()).toEqual({ email });
  });

  test('never hands the session token to the page', async () => {
    const harness = testApp();
    const { email, password } = await makeUser(harness);

    const response = await signIn(harness, { email, password });

    const token = /session_token=([^.;]+)/.exec(cookiesOf(response))?.[1] ?? '';
    expect(token).not.toBe('');
    expect(await response.text()).not.toContain(token);
  });

  test('the address is trimmed and lower-cased', async () => {
    const harness = testApp();
    const { email, password } = await makeUser(harness);

    const response = await signIn(harness, { email: `  ${email.toUpperCase()} `, password });

    expect(response.status).toBe(200);
  });

  test('a wrong password and an unknown address get the very same answer', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);

    const wrongPassword = await signIn(harness, { email, password: 'not the right password' });
    const unknownAddress = await signIn(harness, {
      email: unknownEmail(),
      password: GOOD_PASSWORD,
    });

    for (const response of [wrongPassword, unknownAddress]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'invalid_credentials' });
      expect(response.headers.getSetCookie()).toEqual([]);
    }
  });

  test('takes no option of Better Auth: the session always lasts', async () => {
    const harness = testApp();
    const { email, password } = await makeUser(harness);

    const response = await postJson(harness.app, '/api/auth/sign-in/email', {
      email,
      password,
      rememberMe: false,
      callbackURL: 'https://evil.example',
    });

    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join('\n')).toContain('Max-Age=');
    expect(response.headers.get('Location')).toBeNull();
  });

  test('refuses anything that is not a sign-in', async () => {
    const harness = testApp();

    expect((await signIn(harness, { email: 'not an address', password: 'x' })).status).toBe(400);
    expect((await signIn(harness, { email: unknownEmail(), password: '' })).status).toBe(400);
    expect(
      (await signIn(harness, { email: unknownEmail(), password: 'a'.repeat(129) })).status,
    ).toBe(400);
    expect((await signIn(harness, { email: unknownEmail(), password: 42 })).status).toBe(400);
    expect((await postJson(harness.app, '/api/auth/sign-in/email', 'not json')).status).toBe(400);
  });

  test('logs the User of a success, and neither the address nor the password', async () => {
    const harness = testApp();
    const { email, password, userId } = await makeUser(harness);

    await signIn(harness, { email, password });
    await signIn(harness, { email, password: 'not the right password' });

    const requests = harness
      .logs()
      .filter(
        (line) =>
          typeof line === 'object' &&
          line !== null &&
          'route' in line &&
          line.route === '/api/auth/sign-in/email',
      );
    expect(requests).toEqual([
      expect.objectContaining({ status: 200, userId }),
      expect.objectContaining({ status: 401 }),
    ]);
    expect(requests[1]).not.toHaveProperty('userId');
    expect(harness.output()).not.toContain(email);
    expect(harness.output()).not.toContain(password);
    expect(harness.output()).not.toContain('not the right password');
  });
});

describe('repeated failures on one address', () => {
  const TOO_MANY = { error: 'too_many_attempts' };

  test('are not slowed down before the 5th', async () => {
    const harness = testApp();
    const { email, password } = await makeUser(harness);

    await fail(harness, email, 5);

    expect(harness.clock.slept).toEqual([]);
    expect((await signIn(harness, { email, password })).status).toBe(200);
  });

  test('from the 5th, each attempt waits longer than the one before', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);

    await fail(harness, email, 10);

    expect(harness.clock.slept).toEqual([1000, 2000, 4000, 8000, 16_000]);
  });

  test('the delay counts from the previous attempt: a User who took their time does not wait', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    await fail(harness, email, 6);
    expect(harness.clock.slept).toEqual([1000]);

    harness.clock.advance('PT1S');
    await fail(harness, email, 1);
    harness.clock.advance('PT30S');
    await fail(harness, email, 1);

    expect(harness.clock.slept).toEqual([1000, 1000]);
  });

  test('the 10th blocks the address for 15 minutes, even with the right password', async () => {
    const harness = testApp();
    const { email, password } = await makeUser(harness);
    await fail(harness, email, 10);

    const blocked = await signIn(harness, { email, password });
    harness.clock.advance('PT14M59S');
    const stillBlocked = await signIn(harness, { email, password });

    for (const response of [blocked, stillBlocked]) {
      expect(response.status).toBe(429);
      expect(await response.json()).toEqual(TOO_MANY);
      expect(response.headers.getSetCookie()).toEqual([]);
    }

    harness.clock.advance('PT1S');
    expect((await signIn(harness, { email, password })).status).toBe(200);
  });

  test('an address without an account is slowed down and blocked alike', async () => {
    const harness = testApp();
    const email = unknownEmail();

    await fail(harness, email, 10);
    const blocked = await signIn(harness, { email, password: GOOD_PASSWORD });

    expect(harness.clock.slept).toEqual([1000, 2000, 4000, 8000, 16_000]);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual(TOO_MANY);
  });

  test('count whatever the case of the address and wherever they come from', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);

    await fail(harness, email, 5);
    await fail(harness, email.toUpperCase(), 5);

    expect((await signIn(harness, { email, password: GOOD_PASSWORD })).status).toBe(429);
  });

  test('are forgotten by a successful sign-in', async () => {
    const harness = testApp();
    const { email, password } = await makeUser(harness);
    await fail(harness, email, 4);

    expect((await signIn(harness, { email, password })).status).toBe(200);
    await fail(harness, email, 5);

    expect(harness.clock.slept).toEqual([]);
  });

  test('add up as long as they keep coming: no fresh start every 15 minutes', async () => {
    const harness = testApp();
    const { email, password } = await makeUser(harness);
    await fail(harness, email, 9);

    harness.clock.advance('PT14M59S');
    await fail(harness, email, 1);

    expect((await signIn(harness, { email, password })).status).toBe(429);
  });

  test('are forgotten after 15 minutes without an attempt', async () => {
    const harness = testApp();
    const { email } = await makeUser(harness);
    await fail(harness, email, 5);

    harness.clock.advance('PT15M');
    await fail(harness, email, 5);

    expect(harness.clock.slept).toEqual([]);
  });

  test('leave the other addresses alone', async () => {
    const harness = testApp();
    const victim = await makeUser(harness);
    const other = await makeUser(harness);

    await fail(harness, victim.email, 10);

    const response = await signIn(harness, other);
    expect(response.status).toBe(200);
  });

  test('attempts sent together are counted one by one: none slips past the block', async () => {
    const harness = testApp();
    const email = unknownEmail();

    const responses = await Promise.all(
      Array.from({ length: 14 }, () => signIn(harness, { email, password: GOOD_PASSWORD })),
    );

    expect(responses.map((response) => response.status).toSorted((a, b) => a - b)).toEqual([
      ...Array.from({ length: 10 }, () => 401),
      ...Array.from({ length: 4 }, () => 429),
    ]);
  });
});

// Thirty sign-ins in a row, each hashing a password: slow on a loaded CI runner.
describe('repeated attempts from one IP address', { timeout: 20_000 }, () => {
  test('the 31st in 15 minutes is refused, whatever the address it tries', async () => {
    const harness = testApp();
    const ip = randomIp();
    const { email, password } = await makeUser(harness);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await signIn(harness, { email: unknownEmail(), password: 'x' }, { ip });
      expect(response.status).toBe(401);
    }

    const refused = await signIn(harness, { email, password }, { ip });
    const fromElsewhere = await signIn(harness, { email, password });

    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: 'too_many_attempts' });
    expect(refused.headers.getSetCookie()).toEqual([]);
    expect(fromElsewhere.status).toBe(200);
  });

  test('the address counted is the one Traefik saw, never one the client claims', async () => {
    const harness = testApp();
    const ip = randomIp();
    const attempt = (claimed: string) =>
      signIn(harness, { email: unknownEmail(), password: 'x' }, { ip: `${claimed}, ${ip}` });
    for (let count = 0; count < 30; count += 1) await attempt(randomIp());

    expect((await attempt(randomIp())).status).toBe(429);
  });
});

describe('signing out', () => {
  test('ends the session of this device and erases its cookie, without asking anything', async () => {
    const harness = testApp();
    const { cookie } = await makeUser(harness);

    const response = await signOut(harness, cookie);

    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie().join('\n')).toMatch(
      /__Secure-battlecrm\.session_token=;[^\n]*Max-Age=0/,
    );
    expect((await session(harness, cookie)).status).toBe(401);
  });

  test('leaves the other devices signed in', async () => {
    const harness = testApp();
    const { cookie, email, password } = await makeUser(harness);
    const otherDevice = cookiesOf(await signIn(harness, { email, password }));

    await signOut(harness, cookie);

    expect((await session(harness, otherDevice)).status).toBe(200);
  });

  test('answers alike without a session', async () => {
    const harness = testApp();

    expect((await signOut(harness)).status).toBe(204);
  });
});
