import { beforeEach, describe, expect, test } from 'vitest';
import { commands, page } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi, signedOut } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';

const PASSWORD = 'correct horse battery staple';
const ASK = 'POST /api/password-reset';
const COMPLETE = 'POST /api/password-reset/complete';
const NEUTRAL = 'Si un compte existe pour cette adresse, un lien vient de partir.';

const sent = { [ASK]: () => new Response(null, { status: 204 }) };
const completed = { [COMPLETE]: () => Response.json({ email: 'jane@example.com' }) };
const refusedWith = (error: string, status: number) => ({
  [COMPLETE]: () => Response.json({ error }, { status }),
});

type Screen = Awaited<ReturnType<typeof renderApp>>['screen'];

const heading = (screen: Screen, name: string) => screen.getByRole('heading', { level: 1, name });
const newPassword = (screen: Screen) =>
  screen.getByLabelText('Nouveau mot de passe', { exact: true });

async function askFor(screen: Screen, email = 'jane@example.com') {
  await screen.getByRole('textbox', { name: 'E-mail' }).fill(email);
  await screen.getByRole('button', { name: 'Envoyer le lien' }).click();
}

async function choose(screen: Screen, password = PASSWORD) {
  await newPassword(screen).fill(password);
  await screen.getByRole('button', { name: 'Changer le mot de passe' }).click();
}

beforeEach(() => page.viewport(1280, 800));

describe('“Forgot your password?”', () => {
  test('is offered by the sign-in screen', async () => {
    const { screen, router } = await renderApp('/sign-in', fakeApi(signedOut));

    await screen.getByRole('link', { name: 'Mot de passe oublié ?' }).click();

    await expect.element(heading(screen, 'Mot de passe oublié')).toBeVisible();
    expect(router.state.location.pathname).toBe('/forgot-password');
  });

  test('sends the address, then says the neutral sentence of the spec', async () => {
    const { screen, api } = await renderApp('/forgot-password', fakeApi({ ...signedOut, ...sent }));

    await askFor(screen);

    await expect.element(screen.getByRole('status')).toHaveTextContent(NEUTRAL);
    expect(api.sent(ASK)).toEqual([{ route: ASK, body: { email: 'jane@example.com' } }]);
    await expect
      .element(screen.getByRole('button', { name: 'Envoyer le lien' }))
      .not.toBeInTheDocument();
    await screen.getByRole('link', { name: 'Retour à la connexion' }).click();
    await expect.element(heading(screen, 'Connexion')).toBeVisible();
  });

  test('a malformed address is refused before any request', async () => {
    const { screen, api } = await renderApp('/forgot-password', fakeApi({ ...signedOut, ...sent }));

    await askFor(screen, 'jane');

    await expect.element(screen.getByText('Saisis une adresse e-mail valide.')).toBeVisible();
    expect(api.sent(ASK)).toEqual([]);
  });

  test('says when the API failed, and never the neutral sentence', async () => {
    const { screen } = await renderApp(
      '/forgot-password',
      fakeApi({ ...signedOut, [ASK]: () => new Response(null, { status: 500 }) }),
    );

    await askFor(screen);

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent("Quelque chose n'a pas fonctionné. Réessaie dans un instant.");
    await expect.element(screen.getByText(NEUTRAL)).not.toBeInTheDocument();
  });

  test('is reachable with a session: “It was not me” leads here from a security e-mail', async () => {
    const { screen, router } = await renderApp('/forgot-password', fakeApi(sent));

    await expect.element(heading(screen, 'Mot de passe oublié')).toBeVisible();
    expect(router.state.location.pathname).toBe('/forgot-password');
  });
});

describe('the reset link', () => {
  test('sends its token with the new password, then lands on Today, signed in', async () => {
    const api = fakeApi({ ...signedOut, ...completed });
    const { screen, router } = await renderApp('/reset-password#the-token', api);

    await choose(screen);

    await expect.element(heading(screen, "Aujourd'hui")).toBeVisible();
    expect(router.state.location.pathname).toBe('/today');
    expect(api.sent(COMPLETE)).toEqual([
      { route: COMPLETE, body: { token: 'the-token', password: PASSWORD } },
    ]);
    await expect.element(screen.getByText('jane@example.com')).toBeVisible();
  });

  test('erases what a previous User left on this device', async () => {
    const { screen, queryClient } = await renderApp(
      '/reset-password#the-token',
      fakeApi({ ...signedOut, ...completed }),
    );
    queryClient.setQueryData(['left-behind'], 'by someone else');

    await choose(screen);

    await expect.element(heading(screen, "Aujourd'hui")).toBeVisible();
    expect(queryClient.getQueryData(['left-behind'])).toBeUndefined();
  });

  test('asks for a new password: its rule is said, a password manager knows it is a new one', async () => {
    const { screen, api } = await renderApp(
      '/reset-password#the-token',
      fakeApi({ ...signedOut, ...completed }),
    );

    await expect.element(newPassword(screen)).toHaveAttribute('autocomplete', 'new-password');
    await expect
      .element(screen.getByText("15 caractères minimum. Une phrase fait très bien l'affaire."))
      .toBeVisible();

    await choose(screen, 'fourteen chars');

    await expect.element(newPassword(screen)).toBeInvalid();
    expect(api.sent(COMPLETE)).toEqual([]);
  });

  test('a link that has expired or already served says so, and offers a new one', async () => {
    const { screen, router } = await renderApp(
      '/reset-password#old-token',
      fakeApi({ ...signedOut, ...sent, ...refusedWith('invalid_link', 400) }),
    );

    await choose(screen);

    await expect.element(heading(screen, "Ce lien n'est plus valable")).toBeVisible();
    await screen.getByRole('link', { name: 'Demander un nouveau lien' }).click();
    await expect.element(heading(screen, 'Mot de passe oublié')).toBeVisible();
    expect(router.state.location.pathname).toBe('/forgot-password');
  });

  test('without a token, says the same at once, and asks the API nothing', async () => {
    const api = fakeApi({ ...signedOut, ...completed });
    const { screen } = await renderApp('/reset-password', api);

    await expect.element(heading(screen, "Ce lien n'est plus valable")).toBeVisible();
    expect(api.sent(COMPLETE)).toEqual([]);
  });

  test('a password known to have leaked gets the sentence of the spec, on the field', async () => {
    const { screen } = await renderApp(
      '/reset-password#the-token',
      fakeApi({ ...signedOut, ...refusedWith('password_compromised', 400) }),
    );

    await choose(screen);

    await expect.element(newPassword(screen)).toBeInvalid();
    await expect
      .element(
        screen.getByText(
          'Ce mot de passe apparaît dans des fuites de données connues, choisis-en un autre.',
        ),
      )
      .toBeVisible();
  });

  test('says when the password could not be checked, or when the API failed', async () => {
    const unavailable = await renderApp(
      '/reset-password#the-token',
      fakeApi({ ...signedOut, ...refusedWith('password_check_unavailable', 503) }),
    );
    await choose(unavailable.screen);
    await expect
      .element(unavailable.screen.getByRole('alert'))
      .toHaveTextContent("Ce mot de passe n'a pas pu être vérifié pour le moment.");
    await unavailable.screen.unmount();

    const broken = await renderApp(
      '/reset-password#the-token',
      fakeApi({ ...signedOut, [COMPLETE]: () => new Response(null, { status: 500 }) }),
    );
    await choose(broken.screen);
    await expect
      .element(broken.screen.getByRole('alert'))
      .toHaveTextContent("Quelque chose n'a pas fonctionné.");
  });
});

describe.each(['light', 'dark'] as const)('axe finds nothing in the %s theme', (scheme) => {
  // Before the first render: a colour measured during a transition would prove nothing.
  beforeEach(() => commands.emulateColorScheme(scheme));
  const themed = async () => {
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');
  };

  test.each([
    ['desktop', 1280],
    ['mobile', 390],
  ] as const)('on “Forgot your password?”, before and after, %s', async (_width, width) => {
    await page.viewport(width, 800);
    const { screen } = await renderApp('/forgot-password', fakeApi({ ...signedOut, ...sent }));
    await expect.element(heading(screen, 'Mot de passe oublié')).toBeVisible();
    await themed();
    await expectNoAxeViolations();

    await askFor(screen);
    await expect.element(screen.getByRole('status')).toHaveTextContent(NEUTRAL);
    await expectNoAxeViolations();
  });

  test('on the new password, refused, and on a link no longer valid', async () => {
    const reset = await renderApp(
      '/reset-password#the-token',
      fakeApi({ ...signedOut, ...refusedWith('password_compromised', 400) }),
    );
    await choose(reset.screen);
    await expect.element(newPassword(reset.screen)).toBeInvalid();
    await themed();
    await expectNoAxeViolations();
    await reset.screen.unmount();

    const invalid = await renderApp('/reset-password', fakeApi(signedOut));
    await expect.element(heading(invalid.screen, "Ce lien n'est plus valable")).toBeVisible();
    await expectNoAxeViolations();
  });
});
