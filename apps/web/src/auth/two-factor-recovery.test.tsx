import { beforeEach, describe, expect, test } from 'vitest';
import { commands, page } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi, signedOut } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';

const SIGN_IN = 'POST /api/auth/sign-in/email';
const REQUEST = 'POST /api/two-factor-recovery';
const CANCEL = 'POST /api/two-factor-recovery/cancel';

/** An account with a second factor: the password is right, a code is awaited. */
const codeAwaited = { [SIGN_IN]: () => Response.json({ twoFactorRequired: true }) };
/** Noon in UTC: the same day in every time zone a browser may run in. */
const started = { [REQUEST]: () => Response.json({ dueAt: '2026-01-12T12:00:00.000Z' }) };

type Screen = Awaited<ReturnType<typeof renderApp>>['screen'];

const heading = (screen: Screen, name: string) => screen.getByRole('heading', { level: 1, name });

/** The code screen of a sign-in, the password given. */
async function atTheCode(routes: Parameters<typeof fakeApi>[0] = {}) {
  const rendered = await renderApp(
    '/sign-in',
    fakeApi({ ...signedOut, ...codeAwaited, ...routes }),
  );
  const { screen } = rendered;
  await screen.getByRole('textbox', { name: 'E-mail' }).fill('jane@example.com');
  await screen.getByLabelText('Mot de passe', { exact: true }).fill('correct horse battery staple');
  await screen.getByRole('button', { name: 'Se connecter' }).click();
  await expect.element(heading(screen, 'Double authentification')).toBeVisible();
  return rendered;
}

const lost = (screen: Screen) =>
  screen.getByRole('button', { name: "Je n'ai plus accès à mes codes" }).click();
const request = (screen: Screen) =>
  screen.getByRole('button', { name: 'Demander la récupération' }).click();

/** Off the button just pressed, and once its colour has settled, as axe measures no hover elsewhere. */
async function pointerOff(screen: Screen) {
  await screen.getByRole('heading', { level: 1 }).hover();
  await expect.poll(() => document.getAnimations().length).toBe(0);
}

beforeEach(() => page.viewport(1280, 800));

describe('a second factor that is lost', () => {
  test('the code screen explains the recovery before anything is asked', async () => {
    const { screen, api } = await atTheCode(started);

    await lost(screen);

    await expect
      .element(screen.getByText(/Elle prend effet au bout de 7 jours : un e-mail te prévient/))
      .toBeVisible();
    await expect.element(screen.getByRole('textbox', { name: 'Code' })).not.toBeInTheDocument();
    expect(api.sent(REQUEST)).toEqual([]);
  });

  test('asking says when the second factor goes, and that an e-mail lets cancel', async () => {
    const { screen, api, router } = await atTheCode(started);
    await lost(screen);

    await request(screen);

    await expect
      .element(
        screen.getByText(
          /^La double authentification sera désactivée le 12 janvier 2026\. Ton mot de passe suffira alors pour te connecter\. Un e-mail t'a été envoyé : son lien permet d'annuler\.$/,
        ),
      )
      .toBeVisible();
    // The challenge cookie is the whole request.
    expect(api.sent(REQUEST)).toEqual([{ route: REQUEST, body: undefined }]);
    await expect
      .element(screen.getByRole('button', { name: 'Demander la récupération' }))
      .not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');

    await screen.getByRole('button', { name: 'Retour à la connexion' }).click();
    await expect.element(heading(screen, 'Connexion')).toBeVisible();
  });

  test('“Back to the code” gives the code field again', async () => {
    const { screen, api } = await atTheCode(started);
    await lost(screen);

    await screen.getByRole('button', { name: 'Revenir au code' }).click();

    await expect.element(screen.getByRole('textbox', { name: 'Code' })).toBeVisible();
    expect(api.sent(REQUEST)).toEqual([]);
  });

  test('a first step that no longer stands leads back to the password', async () => {
    const { screen } = await atTheCode({
      [REQUEST]: () => Response.json({ error: 'challenge_expired' }, { status: 401 }),
    });
    await lost(screen);

    await request(screen);

    await expect.element(heading(screen, 'Connexion')).toBeVisible();
    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('La connexion a pris trop de temps. Recommence avec ton mot de passe.');
  });

  test('says when the API failed, and lets ask again', async () => {
    const { screen, api } = await atTheCode({
      [REQUEST]: () => new Response(null, { status: 500 }),
    });
    await lost(screen);

    await request(screen);

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent("Quelque chose n'a pas fonctionné. Réessaie dans un instant.");
    await request(screen);
    await expect.poll(() => api.sent(REQUEST)).toHaveLength(2);
  });
});

describe('the link to cancel a recovery', () => {
  test('cancels it at the click, and tells to choose a new password', async () => {
    const api = fakeApi({ ...signedOut, [CANCEL]: () => new Response(null, { status: 204 }) });

    const { screen } = await renderApp('/cancel-two-factor-recovery#the-token', api);

    await expect.element(heading(screen, 'Récupération annulée')).toBeVisible();
    await expect
      .element(screen.getByText(/La double authentification reste active sur ton compte\./))
      .toBeVisible();
    expect(api.sent(CANCEL)).toEqual([{ route: CANCEL, body: { token: 'the-token' } }]);
    await expect
      .element(screen.getByRole('link', { name: 'Choisir un nouveau mot de passe' }))
      .toHaveAttribute('href', '/forgot-password');
  });

  test('works with a session too: the e-mail may be opened on a device signed in', async () => {
    const api = fakeApi({ [CANCEL]: () => new Response(null, { status: 204 }) });

    const { screen } = await renderApp('/cancel-two-factor-recovery#the-token', api);

    await expect.element(heading(screen, 'Récupération annulée')).toBeVisible();
  });

  test('a link that already served, or whose recovery ended, says so', async () => {
    const api = fakeApi({
      ...signedOut,
      [CANCEL]: () => Response.json({ error: 'invalid_link' }, { status: 400 }),
    });

    const { screen } = await renderApp('/cancel-two-factor-recovery#old-token', api);

    await expect.element(heading(screen, "Ce lien n'est plus valable")).toBeVisible();
    await expect.element(screen.getByRole('link', { name: 'Se connecter' })).toBeVisible();
    expect(api.sent(CANCEL)).toHaveLength(1);
  });

  test('says when the API failed', async () => {
    const api = fakeApi({ ...signedOut, [CANCEL]: () => new Response(null, { status: 500 }) });

    const { screen } = await renderApp('/cancel-two-factor-recovery#the-token', api);

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent("Quelque chose n'a pas fonctionné. Réessaie dans un instant.");
  });
});

describe.each(['light', 'dark'] as const)('axe finds nothing in the %s theme', (scheme) => {
  beforeEach(() => commands.emulateColorScheme(scheme));

  test('on the request of a recovery and its answer', async () => {
    const { screen } = await atTheCode(started);
    await pointerOff(screen);
    await expectNoAxeViolations();

    await lost(screen);
    await pointerOff(screen);
    await expectNoAxeViolations();

    await request(screen);
    await expect.element(screen.getByText(/sera désactivée le 12 janvier 2026/)).toBeVisible();
    await pointerOff(screen);
    await expectNoAxeViolations();
  });

  test('on a recovery cancelled', async () => {
    const { screen } = await renderApp(
      '/cancel-two-factor-recovery#the-token',
      fakeApi({ ...signedOut, [CANCEL]: () => new Response(null, { status: 204 }) }),
    );
    await expect.element(heading(screen, 'Récupération annulée')).toBeVisible();
    await expectNoAxeViolations();
  });
});
