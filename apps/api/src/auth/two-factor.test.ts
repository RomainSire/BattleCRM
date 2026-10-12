import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { BREACHED_PASSWORD, GOOD_PASSWORD, testApp } from '../../test/app.ts';
import { makeUser } from '../../test/factories/user.ts';
import { cookiesOf, postJson } from '../../test/http.ts';
import { totpCode, wrongTotpCode } from '../../test/totp.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const NEW_PASSWORD = 'a brand new passphrase';
const ENABLED_SUBJECTS = [
  'La double authentification est activée',
  'Two-factor authentication is on',
];
const DISABLED_SUBJECTS = [
  'La double authentification est désactivée',
  'Two-factor authentication is off',
];
const BACKUP_CODE = /^[A-Za-z\d]{5}-[A-Za-z\d]{5}$/;

const start = (harness: Harness, cookie: string, password: unknown) =>
  postJson(harness.app, '/api/account/two-factor', { password }, cookie);

const confirm = (
  harness: Harness,
  cookie: string,
  code: unknown,
  password: unknown = GOOD_PASSWORD,
) => postJson(harness.app, '/api/account/two-factor/confirm', { password, code }, cookie);

const regenerate = (harness: Harness, cookie: string, password: unknown) =>
  postJson(harness.app, '/api/account/two-factor/backup-codes', { password }, cookie);

const disable = (harness: Harness, cookie: string, password: unknown) =>
  postJson(harness.app, '/api/account/two-factor/disable', { password }, cookie);

const signIn = (harness: Harness, email: string, password: string) =>
  postJson(harness.app, '/api/auth/sign-in/email', { email, password });

const giveTotp = (harness: Harness, challenge: string, code: unknown, more: object = {}) =>
  postJson(harness.app, '/api/auth/two-factor/verify-totp', { code, ...more }, challenge);

const giveBackupCode = (harness: Harness, challenge: string, code: unknown) =>
  postJson(harness.app, '/api/auth/two-factor/verify-backup-code', { code }, challenge);

const whoAmI = (harness: Harness, cookie: string) =>
  harness.app.request('/api/session', { headers: { Cookie: cookie } });

async function status(harness: Harness, cookie: string): Promise<unknown> {
  const response = await harness.app.request('/api/account/two-factor', {
    headers: { Cookie: cookie },
  });
  expect(response.status).toBe(200);
  return response.json();
}

async function emailsTo(harness: Harness, email: string, subjects: string[]) {
  return (await harness.emails()).filter(
    (message) => message.to === email && subjects.includes(message.subject),
  );
}

const totpUriOf = async (response: Response) =>
  z.object({ totpUri: z.string() }).parse(await response.json()).totpUri;

const backupCodesOf = async (response: Response) =>
  z.object({ backupCodes: z.array(z.string()) }).parse(await response.json()).backupCodes;

/** The key of the authenticator app, as the first step of turning the second factor on hands it. */
async function started(harness: Harness, user: User): Promise<string> {
  const response = await start(harness, user.cookie, user.password);
  expect(response.status).toBe(200);
  return totpUriOf(response);
}

/** A User whose second factor is on: the key, the backup codes, and the session that turned it on. */
async function withSecondFactor(harness: Harness, options?: Parameters<typeof makeUser>[1]) {
  const user = await makeUser(harness, options);
  const totpUri = await started(harness, user);
  const response = await confirm(harness, user.cookie, totpCode(totpUri));
  expect(response.status).toBe(200);
  const backupCodes = await backupCodesOf(response);
  return { ...user, totpUri, backupCodes, cookie: cookiesOf(response) };
}

/** The first step of a sign-in: the password is right, a code is awaited. Returns the challenge cookie. */
async function challenged(harness: Harness, user: { email: string; password: string }) {
  const response = await signIn(harness, user.email, user.password);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ twoFactorRequired: true });
  return cookiesOf(response);
}

/** Asks for a reset link and reads its token in the e-mail. */
async function resetToken(harness: Harness, email: string): Promise<string> {
  await postJson(harness.app, '/api/password-reset', { email });
  const sent = (await harness.emails()).findLast(
    (message) => message.to === email && message.text.includes('/reset-password#'),
  );
  const token = sent && /\/reset-password#(\S+)/.exec(sent.text)?.[1];
  if (!token) throw new Error(`No reset link was sent to ${email}`);
  return token;
}

const completeReset = (harness: Harness, body: unknown) =>
  postJson(harness.app, '/api/password-reset/complete', body);

describe('turning the second factor on', () => {
  test('a new User has none', async () => {
    const harness = testApp();
    const { cookie } = await makeUser(harness);

    expect(await status(harness, cookie)).toEqual({ enabled: false });
  });

  test('the password gives the key of the authenticator app, and nothing is on yet', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    const response = await start(harness, user.cookie, user.password);

    expect(response.status).toBe(200);
    const uri = new URL(await totpUriOf(response));
    expect(uri.protocol).toBe('otpauth:');
    expect(uri.host).toBe('totp');
    expect(decodeURIComponent(uri.pathname)).toBe(`/BattleCRM:${user.email}`);
    expect(uri.searchParams.get('issuer')).toBe('BattleCRM');
    expect(uri.searchParams.get('secret')).toMatch(/^[A-Z2-7]{32,}$/);
    expect(await status(harness, user.cookie)).toEqual({ enabled: false });
    const direct = await signIn(harness, user.email, user.password);
    expect(await direct.json()).toEqual({ email: user.email });
  });

  test('a wrong password gives nothing', async () => {
    const harness = testApp();
    const { cookie } = await makeUser(harness);

    const response = await start(harness, cookie, 'not the right password');

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'wrong_password' });
  });

  test('a code of the app turns it on and shows 10 backup codes', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const totpUri = await started(harness, user);

    const response = await confirm(harness, user.cookie, totpCode(totpUri));

    expect(response.status).toBe(200);
    const backupCodes = await backupCodesOf(response);
    expect(backupCodes).toHaveLength(10);
    expect(new Set(backupCodes).size).toBe(10);
    for (const code of backupCodes) expect(code).toMatch(BACKUP_CODE);
    const cookie = cookiesOf(response);
    expect(await status(harness, cookie)).toEqual({ enabled: true, backupCodesLeft: 10 });
    expect((await whoAmI(harness, cookie)).status).toBe(200);
  });

  test('a code typed with spaces is the same code', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const code = totpCode(await started(harness, user));

    const response = await confirm(harness, user.cookie, ` ${code.slice(0, 3)} ${code.slice(3)} `);

    expect(response.status).toBe(200);
  });

  test("the User is told by e-mail, in their language, with “It wasn't me”", async () => {
    const harness = testApp();
    const french = await withSecondFactor(harness, { locale: 'fr' });
    const english = await withSecondFactor(harness, { locale: 'en' });

    const [inFrench, ...others] = await emailsTo(harness, french.email, ENABLED_SUBJECTS);
    expect(others).toEqual([]);
    expect(inFrench?.subject).toBe('La double authentification est activée');
    expect(inFrench?.text).toContain("Ce n'était pas moi");
    expect(inFrench?.text).toContain('https://app.battlecrm.test/forgot-password');
    const [inEnglish] = await emailsTo(harness, english.email, ENABLED_SUBJECTS);
    expect(inEnglish?.subject).toBe('Two-factor authentication is on');
  });

  test('a wrong code turns nothing on', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const totpUri = await started(harness, user);

    const response = await confirm(harness, user.cookie, wrongTotpCode(totpUri));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_code' });
    expect(await status(harness, user.cookie)).toEqual({ enabled: false });
    expect(await emailsTo(harness, user.email, ENABLED_SUBJECTS)).toEqual([]);
    expect((await whoAmI(harness, user.cookie)).status).toBe(200);
  });

  test('a code without a key to confirm is refused', async () => {
    const harness = testApp();
    const { cookie } = await makeUser(harness);

    const response = await confirm(harness, cookie, '123456');

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'not_started' });
  });

  test('starting again gives a new key: the previous one confirms nothing', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const first = await started(harness, user);
    const second = await started(harness, user);

    expect(new URL(second).searchParams.get('secret')).not.toBe(
      new URL(first).searchParams.get('secret'),
    );
    expect((await confirm(harness, user.cookie, totpCode(first))).status).toBe(400);
    expect((await confirm(harness, user.cookie, totpCode(second))).status).toBe(200);
  });

  test('once on, it is neither started nor confirmed again', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);

    const again = await start(harness, user.cookie, user.password);
    const confirmed = await confirm(harness, user.cookie, totpCode(user.totpUri));

    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: 'already_enabled' });
    expect(confirmed.status).toBe(409);
    expect(await confirmed.json()).toEqual({ error: 'already_enabled' });
  });

  test('the first code comes with the password too: a session alone turns nothing on', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const totpUri = await started(harness, user);

    const response = await confirm(
      harness,
      user.cookie,
      totpCode(totpUri),
      'not the right password',
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'wrong_password' });
    expect(await status(harness, user.cookie)).toEqual({ enabled: false });
  });
});

describe('signing in with a second factor', () => {
  test('the password alone opens no session: a code is awaited', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);

    const response = await signIn(harness, user.email, user.password);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ twoFactorRequired: true });
    expect(response.headers.getSetCookie().join('\n')).not.toMatch(/session_token=[^;]/);
    expect((await whoAmI(harness, cookiesOf(response))).status).toBe(401);
  });

  test('a code of the app then opens the session', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const challenge = await challenged(harness, user);

    const response = await giveTotp(harness, challenge, totpCode(user.totpUri));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: user.email });
    const signedIn = await whoAmI(harness, cookiesOf(response));
    expect(await signedIn.json()).toEqual({ email: user.email });
  });

  test('a backup code opens the session once, and one less is left', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const [code = ''] = user.backupCodes;

    const first = await giveBackupCode(harness, await challenged(harness, user), code);
    const second = await giveBackupCode(harness, await challenged(harness, user), code);

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ email: user.email });
    expect(second.status).toBe(401);
    expect(await second.json()).toEqual({ error: 'invalid_code' });
    expect(await status(harness, cookiesOf(first))).toEqual({ enabled: true, backupCodesLeft: 9 });
  });

  test('a wrong code opens nothing, and the challenge still takes the right one', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const challenge = await challenged(harness, user);

    const wrong = await giveTotp(harness, challenge, wrongTotpCode(user.totpUri));
    const wrongBackup = await giveBackupCode(harness, challenge, 'aaaaa-bbbbb');
    const right = await giveTotp(harness, challenge, totpCode(user.totpUri));

    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: 'invalid_code' });
    expect(wrong.headers.getSetCookie().join('\n')).not.toMatch(/session_token=[^;]/);
    expect(wrongBackup.status).toBe(401);
    expect(await wrongBackup.json()).toEqual({ error: 'invalid_code' });
    expect(right.status).toBe(200);
  });

  test('a code without a password before it is refused', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);

    const response = await giveTotp(harness, '', totpCode(user.totpUri));
    const backup = await giveBackupCode(harness, '', user.backupCodes[0]);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'challenge_expired' });
    expect(backup.status).toBe(401);
    expect(await backup.json()).toEqual({ error: 'challenge_expired' });
  });

  test('the code of another account, sent with its session, does not pass for the awaited one', async () => {
    const harness = testApp();
    const victim = await withSecondFactor(harness);
    const intruder = await withSecondFactor(harness);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await signIn(harness, victim.email, 'not the right password');
    }
    const challenge = await challenged(harness, victim);

    const response = await giveTotp(
      harness,
      `${intruder.cookie}; ${challenge}`,
      totpCode(intruder.totpUri),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'invalid_code' });
    expect(response.headers.getSetCookie().join('\n')).not.toMatch(/session_token=[^;]/);
    // Nothing was forgotten: the failures of the victim's address go on adding up, into the delay.
    expect(harness.clock.slept).toEqual([]);
    await signIn(harness, victim.email, 'not the right password');
    expect(harness.clock.slept).toHaveLength(1);
  });

  test('a challenge serves once', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const challenge = await challenged(harness, user);
    await giveTotp(harness, challenge, totpCode(user.totpUri));

    const replayed = await giveTotp(harness, challenge, totpCode(user.totpUri));

    expect(replayed.status).toBe(401);
    expect(await replayed.json()).toEqual({ error: 'challenge_expired' });
  });

  test('“trust this device” is never taken: the next sign-in asks for a code again', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const challenge = await challenged(harness, user);

    const response = await giveTotp(harness, challenge, totpCode(user.totpUri), {
      trustDevice: true,
    });

    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join('\n')).not.toContain('trust_device');
    const next = await postJson(
      harness.app,
      '/api/auth/sign-in/email',
      { email: user.email, password: user.password },
      cookiesOf(response),
    );
    expect(await next.json()).toEqual({ twoFactorRequired: true });
  });

  test('a new device is told about once the code is given, not before', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const newDevice = (message: { to: string; subject: string }) =>
      message.to === user.email && message.subject === 'Nouvelle connexion à ton compte BattleCRM';

    const challenge = await challenged(harness, user);
    expect((await harness.emails()).filter(newDevice)).toEqual([]);
    await giveTotp(harness, challenge, totpCode(user.totpUri));

    expect((await harness.emails()).filter(newDevice)).toHaveLength(1);
  });

  test('wrong codes count with the wrong passwords of the address, up to the block', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);

    // Each round: a right password, then wrong codes. The right password erases nothing.
    let failures = 0;
    while (failures < 10) {
      const first = await signIn(harness, user.email, user.password);
      failures += 1;
      if (failures === 10) break;
      const challenge = cookiesOf(first);
      for (let attempt = 0; attempt < 3 && failures < 10; attempt += 1) {
        const wrong = await giveTotp(harness, challenge, wrongTotpCode(user.totpUri));
        expect(wrong.status).toBe(401);
        failures += 1;
      }
    }
    const blocked = await signIn(harness, user.email, user.password);

    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'too_many_attempts' });
  });

  test('a blocked address is refused even the right code', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const challenge = await challenged(harness, user);
    for (let attempt = 0; attempt < 9; attempt += 1) {
      await signIn(harness, user.email, 'not the right password');
    }

    const response = await giveTotp(harness, challenge, totpCode(user.totpUri));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'too_many_attempts' });
  });

  test('a right code erases the failures of the address', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    // Three, and the two steps of the sign-in: one short of the first delay.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await signIn(harness, user.email, 'not the right password');
    }

    await giveTotp(harness, await challenged(harness, user), totpCode(user.totpUri));
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await signIn(harness, user.email, 'not the right password');
    }

    expect(harness.clock.slept).toEqual([]);
  });

  test('refuses anything that is not a code', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const challenge = await challenged(harness, user);

    for (const code of [undefined, 12, '', 'x'.repeat(41)]) {
      const response = await giveTotp(harness, challenge, code);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid' });
    }
  });
});

describe('backup codes', () => {
  test('are made anew with the password: the old ones open nothing', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    await giveBackupCode(harness, await challenged(harness, user), user.backupCodes[0]);

    const response = await regenerate(harness, user.cookie, user.password);

    expect(response.status).toBe(200);
    const backupCodes = await backupCodesOf(response);
    expect(backupCodes).toHaveLength(10);
    for (const code of backupCodes) expect(user.backupCodes).not.toContain(code);
    expect(await status(harness, user.cookie)).toEqual({ enabled: true, backupCodesLeft: 10 });
    const old = await giveBackupCode(harness, await challenged(harness, user), user.backupCodes[1]);
    expect(old.status).toBe(401);
    const fresh = await giveBackupCode(harness, await challenged(harness, user), backupCodes[0]);
    expect(fresh.status).toBe(200);
  });

  test('a wrong password leaves them as they are', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);

    const response = await regenerate(harness, user.cookie, 'not the right password');

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'wrong_password' });
    const kept = await giveBackupCode(
      harness,
      await challenged(harness, user),
      user.backupCodes[0],
    );
    expect(kept.status).toBe(200);
  });

  test('there is none to make while the second factor is off', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    const response = await regenerate(harness, user.cookie, user.password);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'not_enabled' });
  });
});

describe('turning the second factor off', () => {
  test('takes the password: the next sign-in asks for no code, and the User is told', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness, { locale: 'en' });

    const response = await disable(harness, user.cookie, user.password);

    expect(response.status).toBe(204);
    const cookie = cookiesOf(response);
    expect(await status(harness, cookie)).toEqual({ enabled: false });
    const direct = await signIn(harness, user.email, user.password);
    expect(await direct.json()).toEqual({ email: user.email });
    const [told, ...others] = await emailsTo(harness, user.email, DISABLED_SUBJECTS);
    expect(others).toEqual([]);
    expect(told?.subject).toBe('Two-factor authentication is off');
    expect(told?.text).toContain("It wasn't me");
    expect(told?.text).toContain('https://app.battlecrm.test/forgot-password');
  });

  test('a wrong password leaves it on', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);

    const response = await disable(harness, user.cookie, 'not the right password');

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'wrong_password' });
    expect(await status(harness, user.cookie)).toEqual({ enabled: true, backupCodesLeft: 10 });
    expect(await emailsTo(harness, user.email, DISABLED_SUBJECTS)).toEqual([]);
  });

  test('there is nothing to turn off twice', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    const response = await disable(harness, user.cookie, user.password);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'not_enabled' });
  });

  test('turned on again, it takes a new key and new backup codes', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const off = await disable(harness, user.cookie, user.password);
    const cookie = cookiesOf(off);

    const totpUri = await started(harness, { ...user, cookie });
    const response = await confirm(harness, cookie, totpCode(totpUri));

    expect(response.status).toBe(200);
    const backupCodes = await backupCodesOf(response);
    for (const code of backupCodes) expect(user.backupCodes).not.toContain(code);
  });
});

describe('resetting the password of an account with a second factor', () => {
  test('without a code, nothing changes and the link still serves', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const token = await resetToken(harness, user.email);

    const response = await completeReset(harness, { token, password: NEW_PASSWORD });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'two_factor_required' });
    expect(response.headers.getSetCookie().join('\n')).not.toMatch(/session_token=[^;]/);
    expect((await signIn(harness, user.email, NEW_PASSWORD)).status).toBe(401);
    const withCode = await completeReset(harness, {
      token,
      password: NEW_PASSWORD,
      code: totpCode(user.totpUri),
    });
    expect(withCode.status).toBe(200);
  });

  test('a code of the app lets the new password in, and signs this device in', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const token = await resetToken(harness, user.email);

    const response = await completeReset(harness, {
      token,
      password: NEW_PASSWORD,
      code: totpCode(user.totpUri),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: user.email });
    expect((await whoAmI(harness, cookiesOf(response))).status).toBe(200);
    expect((await whoAmI(harness, user.cookie)).status).toBe(401);
    // The second factor is still on, with the new password.
    await challenged(harness, { email: user.email, password: NEW_PASSWORD });
  });

  test('a backup code does too, and is used up', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const token = await resetToken(harness, user.email);

    const response = await completeReset(harness, {
      token,
      password: NEW_PASSWORD,
      code: user.backupCodes[3],
    });

    expect(response.status).toBe(200);
    expect(await status(harness, cookiesOf(response))).toEqual({
      enabled: true,
      backupCodesLeft: 9,
    });
  });

  test('a wrong code changes nothing and leaves the link alone', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const token = await resetToken(harness, user.email);

    const wrong = await completeReset(harness, {
      token,
      password: NEW_PASSWORD,
      code: wrongTotpCode(user.totpUri),
    });
    const wrongBackup = await completeReset(harness, {
      token,
      password: NEW_PASSWORD,
      code: 'aaaaa-bbbbb',
    });

    expect(wrong.status).toBe(403);
    expect(await wrong.json()).toEqual({ error: 'invalid_code' });
    expect(wrongBackup.status).toBe(403);
    expect(await wrongBackup.json()).toEqual({ error: 'invalid_code' });
    expect((await signIn(harness, user.email, NEW_PASSWORD)).status).toBe(401);
    const right = await completeReset(harness, {
      token,
      password: NEW_PASSWORD,
      code: totpCode(user.totpUri),
    });
    expect(right.status).toBe(200);
  });

  test('a refused password uses no backup code up', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const token = await resetToken(harness, user.email);

    const response = await completeReset(harness, {
      token,
      password: BREACHED_PASSWORD,
      code: user.backupCodes[0],
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'password_compromised' });
    expect(await status(harness, user.cookie)).toEqual({ enabled: true, backupCodesLeft: 10 });
  });

  test('wrong codes count with the failed sign-ins of the address, up to the block', async () => {
    const harness = testApp();
    const user = await withSecondFactor(harness);
    const token = await resetToken(harness, user.email);
    const attempt = (code: string) =>
      completeReset(harness, { token, password: NEW_PASSWORD, code });

    for (let failure = 0; failure < 10; failure += 1) {
      expect((await attempt(wrongTotpCode(user.totpUri))).status).toBe(403);
    }
    const blocked = await attempt(totpCode(user.totpUri));

    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'too_many_attempts' });
    expect((await signIn(harness, user.email, NEW_PASSWORD)).status).toBe(429);
  });

  test('an account without a second factor is asked for no code', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const token = await resetToken(harness, user.email);

    const response = await completeReset(harness, { token, password: NEW_PASSWORD });

    expect(response.status).toBe(200);
  });
});
