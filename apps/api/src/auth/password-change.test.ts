import { describe, expect, test } from 'vitest';

import { BREACHED_PASSWORD, testApp } from '../../test/app.ts';
import { makeUser } from '../../test/factories/user.ts';
import { cookiesOf, postJson } from '../../test/http.ts';

type Harness = ReturnType<typeof testApp>;

const NEW_PASSWORD = 'a brand new passphrase';
const CHANGED_SUBJECTS = ['Ton mot de passe a été modifié', 'Your password was changed'];

const change = (harness: Harness, cookie: string | undefined, body: unknown) =>
  postJson(harness.app, '/api/account/password', body, cookie);

const signIn = (harness: Harness, email: string, password: string) =>
  postJson(harness.app, '/api/auth/sign-in/email', { email, password });

const whoAmI = (harness: Harness, cookie: string) =>
  harness.app.request('/api/session', { headers: { Cookie: cookie } });

async function changedEmails(harness: Harness, email: string) {
  return (await harness.emails()).filter(
    (message) => message.to === email && CHANGED_SUBJECTS.includes(message.subject),
  );
}

describe('changing the password', () => {
  test('with the current one: the new password signs in, the old one no longer does', async () => {
    const harness = testApp();
    const { email, password, cookie } = await makeUser(harness);

    const response = await change(harness, cookie, { password, newPassword: NEW_PASSWORD });

    expect(response.status).toBe(204);
    expect((await signIn(harness, email, password)).status).toBe(401);
    expect((await signIn(harness, email, NEW_PASSWORD)).status).toBe(200);
    expect(harness.output()).not.toContain(password);
    expect(harness.output()).not.toContain(NEW_PASSWORD);
  });

  test('signs the other devices out, and keeps this one', async () => {
    const harness = testApp();
    const { email, password, cookie } = await makeUser(harness);
    const otherDevice = cookiesOf(await signIn(harness, email, password));
    const someoneElse = await makeUser(harness);

    await change(harness, cookie, { password, newPassword: NEW_PASSWORD });

    expect((await whoAmI(harness, otherDevice)).status).toBe(401);
    expect((await whoAmI(harness, cookie)).status).toBe(200);
    expect((await whoAmI(harness, someoneElse.cookie)).status).toBe(200);
  });

  test('tells the User by e-mail, in their language, with “It was not me”', async () => {
    const harness = testApp();
    const french = await makeUser(harness, { locale: 'fr' });
    const english = await makeUser(harness, { locale: 'en' });

    for (const { cookie, password } of [french, english]) {
      await change(harness, cookie, { password, newPassword: NEW_PASSWORD });
    }

    const [inFrench, ...others] = await changedEmails(harness, french.email);
    expect(others).toEqual([]);
    expect(inFrench?.subject).toBe('Ton mot de passe a été modifié');
    expect(inFrench?.text).toContain(
      "Ce n'était pas moi\nhttps://app.battlecrm.test/forgot-password",
    );
    const [inEnglish] = await changedEmails(harness, english.email);
    expect(inEnglish?.subject).toBe('Your password was changed');
    expect(inEnglish?.text).toContain("It wasn't me\nhttps://app.battlecrm.test/forgot-password");
  });

  test('a reset link already on its way opens nothing any more', async () => {
    const harness = testApp();
    const { email, password, cookie } = await makeUser(harness);
    await postJson(harness.app, '/api/password-reset', { email });
    const sent = (await harness.emails()).findLast((message) => message.to === email);
    const token = /\/reset-password#(\S+)/.exec(sent?.text ?? '')?.[1];
    expect(token).toBeDefined();

    await change(harness, cookie, { password, newPassword: NEW_PASSWORD });
    const tooLate = await postJson(harness.app, '/api/password-reset/complete', {
      token,
      password: 'yet another passphrase',
    });

    expect(tooLate.status).toBe(400);
    expect((await signIn(harness, email, NEW_PASSWORD)).status).toBe(200);
  });

  test('a wrong current password changes nothing, and does not sign this device out', async () => {
    const harness = testApp();
    const { email, password, cookie } = await makeUser(harness);

    const response = await change(harness, cookie, {
      password: 'not the right password',
      newPassword: NEW_PASSWORD,
    });

    // Never 401: the SPA reads it as a session ended from elsewhere.
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'wrong_password' });
    expect((await whoAmI(harness, cookie)).status).toBe(200);
    expect((await signIn(harness, email, password)).status).toBe(200);
    expect(await changedEmails(harness, email)).toEqual([]);
  });

  test('the current password is asked for every time: no window after a right one', async () => {
    const harness = testApp();
    const { password, cookie } = await makeUser(harness);
    await change(harness, cookie, { password, newPassword: NEW_PASSWORD });

    const withoutIt = await change(harness, cookie, { newPassword: 'yet another passphrase' });
    const withTheOldOne = await change(harness, cookie, {
      password,
      newPassword: 'yet another passphrase',
    });

    expect(withoutIt.status).toBe(400);
    expect(withTheOldOne.status).toBe(403);
  });

  test('wrong passwords count like failed sign-ins: slowed down, then blocked', async () => {
    const harness = testApp();
    const { email, password, cookie } = await makeUser(harness);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await change(harness, cookie, {
        password: 'not the right password',
        newPassword: NEW_PASSWORD,
      });
      expect(response.status).toBe(403);
    }

    const blocked = await change(harness, cookie, { password, newPassword: NEW_PASSWORD });

    expect(harness.clock.slept).toEqual([1000, 2000, 4000, 8000, 16_000]);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'too_many_attempts' });
    expect((await signIn(harness, email, password)).status).toBe(429);
  });

  test('the right password forgets the failures before it', async () => {
    const harness = testApp();
    const { password, cookie } = await makeUser(harness);
    const wrong = { password: 'not the right password', newPassword: NEW_PASSWORD };
    for (let attempt = 0; attempt < 4; attempt += 1) await change(harness, cookie, wrong);

    await change(harness, cookie, { password, newPassword: NEW_PASSWORD });
    for (let attempt = 0; attempt < 5; attempt += 1) await change(harness, cookie, wrong);

    expect(harness.clock.slept).toEqual([]);
  });

  test('a new password known to have leaked, or impossible to check, is refused', async () => {
    const harness = testApp();
    const { email, password, cookie } = await makeUser(harness);

    const breached = await change(harness, cookie, { password, newPassword: BREACHED_PASSWORD });
    harness.hibp.unreachable = true;
    const unchecked = await change(harness, cookie, { password, newPassword: NEW_PASSWORD });

    expect(breached.status).toBe(400);
    expect(await breached.json()).toEqual({ error: 'password_compromised' });
    expect(unchecked.status).toBe(503);
    expect(await unchecked.json()).toEqual({ error: 'password_check_unavailable' });
    expect((await signIn(harness, email, password)).status).toBe(200);
    expect(await changedEmails(harness, email)).toEqual([]);
  });

  test('a new password judged on its length alone: 15 to 128 characters', async () => {
    const harness = testApp();
    const { password, cookie } = await makeUser(harness);

    expect((await change(harness, cookie, { password, newPassword: 'a'.repeat(14) })).status).toBe(
      400,
    );
    expect((await change(harness, cookie, { password, newPassword: 'a'.repeat(129) })).status).toBe(
      400,
    );
    expect((await change(harness, cookie, { password, newPassword: 'b'.repeat(128) })).status).toBe(
      204,
    );
  });

  test('needs a session', async () => {
    const harness = testApp();
    const { password } = await makeUser(harness);

    const response = await change(harness, undefined, { password, newPassword: NEW_PASSWORD });

    expect(response.status).toBe(401);
  });
});
