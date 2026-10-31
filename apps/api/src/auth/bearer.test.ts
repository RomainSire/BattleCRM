import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { extensionRequest, extensionTokenOf } from '../../test/extension.ts';
import { makeUser } from '../../test/factories/user.ts';
import { cookiesOf, postJson } from '../../test/http.ts';
import { totpCode, wrongTotpCode } from '../../test/totp.ts';

// The Firefox extension holds a token instead of a cookie (plugin `bearer`, ST-90, ST-91): the very same
// session row, with the same rights and the same refusals as the SPA's.

type Harness = ReturnType<typeof testApp>;

const signedIn = z.object({ email: z.string(), token: z.string().min(1) });
const challenged = z.object({ twoFactorRequired: z.literal(true), challenge: z.string().min(1) });

const signIn = (harness: Harness, { email, password }: { email: string; password: string }) =>
  extensionRequest(harness.app, '/api/auth/sign-in/email', { body: { email, password } });

const whoAmI = (harness: Harness, token: string) =>
  extensionRequest(harness.app, '/api/session', { token });

/** A User whose second factor is on, and the key of their authenticator app. */
async function withSecondFactor(harness: Harness) {
  const user = await makeUser(harness);
  const started = await postJson(
    harness.app,
    '/api/account/two-factor',
    { password: user.password },
    user.cookie,
  );
  const { totpUri } = z.object({ totpUri: z.string() }).parse(await started.json());
  const confirmed = await postJson(
    harness.app,
    '/api/account/two-factor/confirm',
    { password: user.password, code: totpCode(totpUri) },
    user.cookie,
  );
  const { backupCodes } = z
    .object({ backupCodes: z.array(z.string()) })
    .parse(await confirmed.json());
  return { ...user, totpUri, backupCodes };
}

const sessionsOf = async (harness: Harness, cookie: string) =>
  z
    .object({
      sessions: z.array(
        z.object({ id: z.string(), browser: z.string().nullable(), extension: z.boolean() }),
      ),
    })
    .parse(
      await (await harness.app.request('/api/sessions', { headers: { Cookie: cookie } })).json(),
    ).sessions;

describe('signing in from the extension', () => {
  test('answers the token of a session, which the extension then sends as Bearer', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    const response = await signIn(harness, user);

    expect(response.status).toBe(200);
    const { email, token } = signedIn.parse(await response.json());
    expect(email).toBe(user.email);
    const me = await whoAmI(harness, token);
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ email: user.email });
  });

  test('a wrong password gets the same answer as in the SPA, and no token', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    const response = await signIn(harness, { email: user.email, password: 'not the right one' });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'invalid_credentials' });
  });

  test('a token nobody signed, or none, is no session', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const token = await extensionTokenOf(harness, user);
    const [value = ''] = token.split('.');

    expect((await whoAmI(harness, `${value}.forged`)).status).toBe(401);
    // The session token alone, as the database keeps it: without the signature, nothing.
    expect((await whoAmI(harness, value)).status).toBe(401);
    expect((await whoAmI(harness, 'forged')).status).toBe(401);
    expect((await extensionRequest(harness.app, '/api/session')).status).toBe(401);
  });
});

describe('signing in from the extension with a second factor', () => {
  test('the password answers a challenge, which comes back with the code and gives the token', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);

    const first = await signIn(harness, user);
    expect(first.status).toBe(200);
    const { challenge } = challenged.parse(await first.json());
    const second = await extensionRequest(harness.app, '/api/auth/two-factor/verify-totp', {
      body: { code: totpCode(user.totpUri), challenge },
    });

    expect(second.status).toBe(200);
    const { token } = signedIn.parse(await second.json());
    expect((await whoAmI(harness, token)).status).toBe(200);
  });

  test('a backup code works the same way', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const { challenge } = challenged.parse(await (await signIn(harness, user)).json());

    const response = await extensionRequest(
      harness.app,
      '/api/auth/two-factor/verify-backup-code',
      {
        body: { code: user.backupCodes[0], challenge },
      },
    );

    expect(response.status).toBe(200);
    expect((await whoAmI(harness, signedIn.parse(await response.json()).token)).status).toBe(200);
  });

  test('a wrong code opens nothing, and a challenge nobody signed is no challenge', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const { challenge } = challenged.parse(await (await signIn(harness, user)).json());
    const verify = (body: object) =>
      extensionRequest(harness.app, '/api/auth/two-factor/verify-totp', { body });

    const wrong = await verify({ code: wrongTotpCode(user.totpUri), challenge });
    const forged = await verify({
      code: totpCode(user.totpUri),
      challenge: `${challenge.split('.')[0]}.forged`,
    });

    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: 'invalid_code' });
    expect(forged.status).toBe(401);
    expect(await forged.json()).toEqual({ error: 'challenge_expired' });
  });

  test('only the extension brings a challenge back in the body: the SPA has its cookie', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const { challenge } = challenged.parse(await (await signIn(harness, user)).json());

    const response = await postJson(harness.app, '/api/auth/two-factor/verify-totp', {
      code: totpCode(user.totpUri),
      challenge,
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'challenge_expired' });
  });

  test('the SPA is never handed the challenge nor the token', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);

    const first = await postJson(harness.app, '/api/auth/sign-in/email', {
      email: user.email,
      password: user.password,
    });
    expect(await first.json()).toEqual({ twoFactorRequired: true });
    const second = await postJson(
      harness.app,
      '/api/auth/two-factor/verify-totp',
      { code: totpCode(user.totpUri) },
      cookiesOf(first),
    );
    expect(await second.json()).toEqual({ email: user.email });
  });
});

describe('the session of the extension', () => {
  test('is named “Firefox extension” in connected devices, and the SPA can end it', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const token = await extensionTokenOf(harness, user);

    const sessions = await sessionsOf(harness, user.cookie);
    expect(sessions).toEqual([
      expect.objectContaining({ extension: false }),
      expect.objectContaining({ browser: 'Firefox', extension: true }),
    ]);
    const revoked = await postJson(
      harness.app,
      `/api/sessions/${sessions[1]!.id}/revoke`,
      {},
      user.cookie,
    );

    expect(revoked.status).toBe(204);
    expect((await whoAmI(harness, token)).status).toBe(401);
    expect(
      (await harness.app.request('/api/session', { headers: { Cookie: user.cookie } })).status,
    ).toBe(200);
  });

  test('signing out with the token ends that session and no other', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const token = await extensionTokenOf(harness, user);

    const response = await extensionRequest(harness.app, '/api/auth/sign-out', { token, body: {} });

    expect(response.status).toBe(204);
    expect((await whoAmI(harness, token)).status).toBe(401);
    expect((await sessionsOf(harness, user.cookie)).map(({ extension }) => extension)).toEqual([
      false,
    ]);
  });

  test('a sign-in from the extension is a new device, worth the security e-mail', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    await extensionTokenOf(harness, user);

    const sent = (await harness.emails()).filter(
      (message) => message.to === user.email && message.text.includes('Firefox'),
    );
    expect(sent).toHaveLength(1);
  });
});
