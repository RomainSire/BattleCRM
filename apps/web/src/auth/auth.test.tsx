import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { commands, page } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi, signedOut } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';

const PASSWORD = 'correct horse battery staple';
const accepted = {
  'POST /api/signup': () => Response.json({ attemptId: 'attempt-1' }, { status: 202 }),
};

afterEach(() => {
  vi.useRealTimers();
});

async function fillSignUp(
  screen: Awaited<ReturnType<typeof renderApp>>['screen'],
  { email = 'jane@example.com', password = PASSWORD } = {},
) {
  await screen.getByRole('textbox', { name: 'E-mail' }).fill(email);
  await screen.getByLabelText('Mot de passe', { exact: true }).fill(password);
  await screen.getByRole('button', { name: 'Créer un compte' }).click();
}

describe('without a session', () => {
  test('every screen of the app leads to signing in', async () => {
    for (const path of ['/', '/contacts', '/settings']) {
      const { screen, router } = await renderApp(path, fakeApi(signedOut));

      await expect
        .element(screen.getByRole('heading', { level: 1, name: 'Connexion' }))
        .toBeVisible();
      expect(router.state.location.pathname).toBe('/sign-in');
      await expect.element(screen.getByRole('navigation')).not.toBeInTheDocument();
      await screen.unmount();
    }
  });

  test('the app stays reachable when the API cannot say who is there', async () => {
    const { screen } = await renderApp(
      '/contacts',
      fakeApi({ 'GET /api/session': () => new Response(null, { status: 503 }) }),
    );

    await expect.element(screen.getByRole('heading', { level: 1, name: 'Contacts' })).toBeVisible();
  });

  test('signing in offers “Create an account”, which leads to the sign-up', async () => {
    const { screen, router } = await renderApp('/sign-in', fakeApi(signedOut));

    await screen.getByRole('link', { name: 'Créer un compte' }).click();

    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Créer un compte' }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe('/sign-up');
  });
});

describe('with a session', () => {
  test('the sign-in and sign-up screens lead back to the app', async () => {
    for (const path of ['/sign-in', '/sign-up']) {
      const { screen, router } = await renderApp(path);

      await expect
        .element(screen.getByRole('heading', { level: 1, name: "Aujourd'hui" }))
        .toBeVisible();
      expect(router.state.location.pathname).toBe('/today');
      await screen.unmount();
    }
  });
});

describe('closed sign-ups', () => {
  const closed = { ...signedOut, 'GET /api/config': () => Response.json({ signupsOpen: false }) };

  test('the link “Create an account” disappears', async () => {
    const { screen } = await renderApp('/sign-in', fakeApi(closed));

    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Connexion' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Créer un compte' }))
      .not.toBeInTheDocument();
  });

  test('the sign-up page says so, without a form', async () => {
    const { screen } = await renderApp('/sign-up', fakeApi(closed));

    await expect
      .element(screen.getByText('Les inscriptions sont fermées pour le moment.'))
      .toBeVisible();
    await expect.element(screen.getByRole('textbox')).not.toBeInTheDocument();
    await expect.element(screen.getByRole('link', { name: 'Se connecter' })).toBeVisible();
  });

  test('a door closed since the page opened shows the same message', async () => {
    const { screen } = await renderApp(
      '/sign-up',
      fakeApi({
        ...signedOut,
        'POST /api/signup': () => Response.json({ error: 'signups_closed' }, { status: 403 }),
      }),
    );

    await fillSignUp(screen);

    await expect
      .element(screen.getByText('Les inscriptions sont fermées pour le moment.'))
      .toBeVisible();
  });
});

describe('signing up', () => {
  test('sends the address, the password, the language and the detected time zone, then says to check the inbox', async () => {
    const { screen, api } = await renderApp('/sign-up', fakeApi({ ...signedOut, ...accepted }));

    await fillSignUp(screen, { email: ' jane@example.com ' });

    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Vérifie ta boîte mail' }))
      .toBeVisible();
    await expect
      .element(screen.getByText(/Un e-mail vient de partir à jane@example\.com\./))
      .toBeVisible();
    expect(api.sent('POST /api/signup')).toEqual([
      {
        route: 'POST /api/signup',
        body: {
          email: ' jane@example.com ',
          password: PASSWORD,
          locale: 'fr',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    ]);
  });

  test('the password can be shown and hidden, and a password manager knows it is a new one', async () => {
    const { screen } = await renderApp('/sign-up', fakeApi(signedOut));
    const password = screen.getByLabelText('Mot de passe', { exact: true });
    await expect.element(password).toHaveAttribute('type', 'password');
    await expect.element(password).toHaveAttribute('autocomplete', 'new-password');
    await expect
      .element(password)
      .toHaveAccessibleDescription("15 caractères minimum. Une phrase fait très bien l'affaire.");

    await screen.getByRole('button', { name: 'Afficher' }).click();
    await expect.element(password).toHaveAttribute('type', 'text');

    await screen.getByRole('button', { name: 'Masquer' }).click();
    await expect.element(password).toHaveAttribute('type', 'password');
  });

  test('a password under 15 characters or a malformed address is refused before any request', async () => {
    const { screen, api } = await renderApp('/sign-up', fakeApi({ ...signedOut, ...accepted }));

    await fillSignUp(screen, { email: 'jane', password: 'fourteen chars' });

    await expect.element(screen.getByText('Saisis une adresse e-mail valide.')).toBeVisible();
    await expect.element(screen.getByLabelText('Mot de passe', { exact: true })).toBeInvalid();
    expect(api.sent('POST /api/signup')).toEqual([]);
  });

  test('a password known to have leaked gets the sentence of the spec, on the field', async () => {
    const { screen } = await renderApp(
      '/sign-up',
      fakeApi({
        ...signedOut,
        'POST /api/signup': () => Response.json({ error: 'password_compromised' }, { status: 400 }),
      }),
    );

    await fillSignUp(screen);

    const password = screen.getByLabelText('Mot de passe', { exact: true });
    await expect.element(password).toBeInvalid();
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
      '/sign-up',
      fakeApi({
        ...signedOut,
        'POST /api/signup': () =>
          Response.json({ error: 'password_check_unavailable' }, { status: 503 }),
      }),
    );
    await fillSignUp(unavailable.screen);
    await expect
      .element(unavailable.screen.getByRole('alert'))
      .toHaveTextContent("Ce mot de passe n'a pas pu être vérifié pour le moment.");
    await unavailable.screen.unmount();

    const broken = await renderApp(
      '/sign-up',
      fakeApi({ ...signedOut, 'POST /api/signup': () => new Response(null, { status: 500 }) }),
    );
    await fillSignUp(broken.screen);
    await expect
      .element(broken.screen.getByRole('alert'))
      .toHaveTextContent("Quelque chose n'a pas fonctionné.");
  });
});

describe('“Check your inbox”', () => {
  test('“Resend the link” waits a minute, then asks for a new link for the same attempt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { screen, api } = await renderApp(
      '/sign-up',
      fakeApi({
        ...signedOut,
        ...accepted,
        'POST /api/signup/resend': () => new Response(null, { status: 204 }),
      }),
    );
    await fillSignUp(screen);

    await expect
      .element(screen.getByRole('button', { name: 'Renvoyer le lien (60 s)' }))
      .toBeDisabled();

    vi.setSystemTime(Date.now() + 60_000);
    await screen.getByRole('button', { name: 'Renvoyer le lien', exact: true }).click();

    await expect
      .element(screen.getByRole('status'))
      .toHaveTextContent("Le lien vient d'être renvoyé.");
    expect(api.sent('POST /api/signup/resend')).toEqual([
      { route: 'POST /api/signup/resend', body: { attemptId: 'attempt-1' } },
    ]);
    await expect
      .element(screen.getByRole('button', { name: 'Renvoyer le lien (60 s)' }))
      .toBeDisabled();
  });

  test('follows the wait the API asks for', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { screen } = await renderApp(
      '/sign-up',
      fakeApi({
        ...signedOut,
        ...accepted,
        'POST /api/signup/resend': () =>
          Response.json({ error: 'too_soon', retryAfterSeconds: 42 }, { status: 429 }),
      }),
    );
    await fillSignUp(screen);

    await expect
      .element(screen.getByRole('button', { name: 'Renvoyer le lien (60 s)' }))
      .toBeDisabled();

    vi.setSystemTime(Date.now() + 60_000);
    await screen.getByRole('button', { name: 'Renvoyer le lien', exact: true }).click();

    await expect
      .element(screen.getByRole('button', { name: 'Renvoyer le lien (42 s)' }))
      .toBeDisabled();
    await expect.element(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  test('“Not the right address?” goes back to the form, the address kept', async () => {
    const { screen } = await renderApp('/sign-up', fakeApi({ ...signedOut, ...accepted }));
    await fillSignUp(screen);

    await screen.getByRole('button', { name: "Ce n'est pas la bonne adresse ?" }).click();

    await expect
      .element(screen.getByRole('textbox', { name: 'E-mail' }))
      .toHaveValue('jane@example.com');
  });
});

describe('the link of the e-mail', () => {
  test('signs this device in and lands on Today', async () => {
    const api = fakeApi({
      ...signedOut,
      'POST /api/signup/verify': () => Response.json({ email: 'jane@example.com' }),
    });

    const { screen, router } = await renderApp('/verify-email#the-token', api);

    await expect
      .element(screen.getByRole('heading', { level: 1, name: "Aujourd'hui" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe('/today');
    expect(api.sent('POST /api/signup/verify')).toEqual([
      { route: 'POST /api/signup/verify', body: { token: 'the-token' } },
    ]);
    // A link that worked leaves no notification behind.
    await expect.element(screen.getByRole('status')).not.toBeInTheDocument();
  });

  test('a link that has expired or already served says so, and offers to start again', async () => {
    const api = fakeApi({
      ...signedOut,
      'POST /api/signup/verify': () => Response.json({ error: 'invalid_link' }, { status: 400 }),
    });

    const { screen } = await renderApp('/verify-email#old-token', api);

    await expect
      .element(screen.getByRole('heading', { level: 1, name: "Ce lien n'est plus valable" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: "Recommencer l'inscription" }))
      .toBeVisible();
    expect(api.sent('POST /api/signup/verify')).toHaveLength(1);
  });
});

describe('the language selector', () => {
  test('is on every authentication screen and switches at once, what was typed kept', async () => {
    const { screen, api } = await renderApp('/sign-up', fakeApi({ ...signedOut, ...accepted }));
    await screen.getByRole('textbox', { name: 'E-mail' }).fill('jane@example.com');

    await screen.getByRole('combobox', { name: 'Langue' }).selectOptions('English');

    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Create an account' }))
      .toBeVisible();
    expect(document.documentElement.lang).toBe('en');
    await expect
      .element(screen.getByRole('textbox', { name: 'Email' }))
      .toHaveValue('jane@example.com');

    await screen.getByLabelText('Password', { exact: true }).fill(PASSWORD);
    await screen.getByRole('button', { name: 'Create an account' }).click();
    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Check your inbox' }))
      .toBeVisible();
    expect(api.sent('POST /api/signup')[0]?.body).toMatchObject({ locale: 'en' });

    await screen.getByRole('combobox', { name: 'Language' }).selectOptions('Français');
    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Vérifie ta boîte mail' }))
      .toBeVisible();
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
  ] as const)('on the sign-in and sign-up screens, %s', async (_width, width) => {
    await page.viewport(width, 800);
    const signIn = await renderApp('/sign-in', fakeApi(signedOut));
    await expect
      .element(signIn.screen.getByRole('link', { name: 'Créer un compte' }))
      .toBeVisible();
    await themed();
    await expectNoAxeViolations();
    await signIn.screen.unmount();

    const signUp = await renderApp('/sign-up', fakeApi(signedOut));
    await fillSignUp(signUp.screen, { email: 'jane', password: 'short' });
    await expect
      .element(signUp.screen.getByText('Saisis une adresse e-mail valide.'))
      .toBeVisible();
    await expectNoAxeViolations();
  });

  test('on “Check your inbox” and on an invalid link', async () => {
    const signUp = await renderApp('/sign-up', fakeApi({ ...signedOut, ...accepted }));
    await fillSignUp(signUp.screen);
    await expect
      .element(signUp.screen.getByRole('heading', { level: 1, name: 'Vérifie ta boîte mail' }))
      .toBeVisible();
    await themed();
    await expectNoAxeViolations();
    await signUp.screen.unmount();

    const invalid = await renderApp(
      '/verify-email#old',
      fakeApi({
        ...signedOut,
        'POST /api/signup/verify': () => Response.json({ error: 'invalid_link' }, { status: 400 }),
      }),
    );
    await expect
      .element(
        invalid.screen.getByRole('heading', { level: 1, name: "Ce lien n'est plus valable" }),
      )
      .toBeVisible();
    await expectNoAxeViolations();
  });
});
