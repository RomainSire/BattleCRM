import { beforeEach, describe, expect, test } from 'vitest';
import { commands, page } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi, signedOut } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';

const PASSWORD = 'correct horse battery staple';
const SIGN_IN = 'POST /api/auth/sign-in/email';
const SIGN_OUT = 'POST /api/auth/sign-out';

const accepted = { [SIGN_IN]: () => Response.json({ email: 'jane@example.com' }) };
const refused = {
  [SIGN_IN]: () => Response.json({ error: 'invalid_credentials' }, { status: 401 }),
};

type Screen = Awaited<ReturnType<typeof renderApp>>['screen'];

async function fillSignIn(
  screen: Screen,
  { email = 'jane@example.com', password = PASSWORD } = {},
) {
  await screen.getByRole('textbox', { name: 'E-mail' }).fill(email);
  await screen.getByLabelText('Mot de passe', { exact: true }).fill(password);
  await screen.getByRole('button', { name: 'Se connecter' }).click();
}

/** What `var(--error)` resolves to in the current theme. */
function errorColour() {
  const probe = document.body.appendChild(document.createElement('span'));
  probe.style.color = 'var(--error)';
  const { color } = getComputedStyle(probe);
  probe.remove();
  return color;
}

/** What carries the outline of a field: the frame it shares with a button, or the field itself. */
const outlined = (field: Element) => field.closest('[data-slot=input-group]') ?? field;

const heading = (screen: Screen, name: string) => screen.getByRole('heading', { level: 1, name });

beforeEach(() => page.viewport(1280, 800));

describe('signing in', () => {
  test('sends the address and the password, then lands on Today, signed in', async () => {
    const { screen, router, api } = await renderApp(
      '/sign-in',
      fakeApi({ ...signedOut, ...accepted }),
    );

    await fillSignIn(screen);

    await expect.element(heading(screen, "Aujourd'hui")).toBeVisible();
    expect(router.state.location.pathname).toBe('/today');
    expect(api.sent(SIGN_IN)).toEqual([
      { route: SIGN_IN, body: { email: 'jane@example.com', password: PASSWORD } },
    ]);
    await expect.element(screen.getByText('jane@example.com')).toBeVisible();
  });

  test('a password manager finds the fields, and the password can be shown', async () => {
    const { screen } = await renderApp('/sign-in', fakeApi(signedOut));
    const email = screen.getByRole('textbox', { name: 'E-mail' });
    const password = screen.getByLabelText('Mot de passe', { exact: true });

    await expect.element(email).toHaveAttribute('autocomplete', 'username');
    await expect.element(password).toHaveAttribute('autocomplete', 'current-password');
    await expect.element(password).toHaveAttribute('type', 'password');

    await screen.getByRole('button', { name: 'Afficher' }).click();

    await expect.element(password).toHaveAttribute('type', 'text');
  });

  test('a refusal gets one message, whatever was wrong, and keeps what was typed', async () => {
    const { screen, router } = await renderApp('/sign-in', fakeApi({ ...signedOut, ...refused }));

    await fillSignIn(screen);

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('Adresse e-mail ou mot de passe incorrect.');
    expect(router.state.location.pathname).toBe('/sign-in');
    await expect
      .element(screen.getByRole('textbox', { name: 'E-mail' }))
      .toHaveValue('jane@example.com');
    await expect
      .element(screen.getByLabelText('Mot de passe', { exact: true }))
      .toHaveValue(PASSWORD);
  });

  test('a refusal is seen: the message in the Error colour, both fields outlined, until one is corrected', async () => {
    const { screen } = await renderApp('/sign-in', fakeApi({ ...signedOut, ...refused }));
    const email = screen.getByRole('textbox', { name: 'E-mail' });
    const password = screen.getByLabelText('Mot de passe', { exact: true });
    await fillSignIn(screen);

    const alert = screen.getByRole('alert');
    await expect.element(alert).toBeVisible();
    expect(getComputedStyle(alert.element()).color).toBe(errorColour());
    for (const field of [email, password]) {
      await expect
        .poll(() => getComputedStyle(outlined(field.element())).borderColor)
        .toBe(errorColour());
    }

    await password.fill('another password');

    await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
    await expect.poll(() => getComputedStyle(email.element()).borderColor).not.toBe(errorColour());
  });

  test('no rule of the sign-up applies: a short password is sent like any other', async () => {
    const { screen, api } = await renderApp('/sign-in', fakeApi({ ...signedOut, ...refused }));

    await fillSignIn(screen, { password: 'short' });

    await expect.element(screen.getByRole('alert')).toBeVisible();
    expect(api.sent(SIGN_IN)).toHaveLength(1);
  });

  test('too many attempts get the sentence of the spec', async () => {
    const { screen } = await renderApp(
      '/sign-in',
      fakeApi({
        ...signedOut,
        [SIGN_IN]: () => Response.json({ error: 'too_many_attempts' }, { status: 429 }),
      }),
    );

    await fillSignIn(screen);

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent(
        'Trop de tentatives. Réessaie dans 15 minutes, ou réinitialise ton mot de passe.',
      );
  });

  test('says when the API failed', async () => {
    const { screen } = await renderApp(
      '/sign-in',
      fakeApi({ ...signedOut, [SIGN_IN]: () => new Response(null, { status: 500 }) }),
    );

    await fillSignIn(screen);

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent("Quelque chose n'a pas fonctionné. Réessaie dans un instant.");
  });

  test('the message of a refusal goes away with the next attempt', async () => {
    let attempts = 0;
    const { screen } = await renderApp(
      '/sign-in',
      fakeApi({
        ...signedOut,
        [SIGN_IN]: () => {
          attempts += 1;
          return attempts === 1 ? refused[SIGN_IN]() : accepted[SIGN_IN]();
        },
      }),
    );
    await fillSignIn(screen);
    await expect.element(screen.getByRole('alert')).toBeVisible();

    await screen.getByRole('button', { name: 'Se connecter' }).click();

    await expect.element(heading(screen, "Aujourd'hui")).toBeVisible();
  });
});

describe('a deep link without a session', () => {
  test('leads to signing in, then back to the page asked for', async () => {
    const { screen, router } = await renderApp(
      '/battles?view=history#top',
      fakeApi({ ...signedOut, ...accepted }),
    );
    await expect.element(heading(screen, 'Connexion')).toBeVisible();
    expect(router.state.location.search).toEqual({ redirect: '/battles?view=history#top' });

    await fillSignIn(screen);

    await expect.element(heading(screen, 'Battles')).toBeVisible();
    expect(router.state.location.href).toBe('/battles?view=history#top');
  });

  test('carries no destination when the page asked for is where signing in leads anyway', async () => {
    for (const path of ['/', '/today']) {
      const { screen, router } = await renderApp(path, fakeApi(signedOut));

      await expect.element(heading(screen, 'Connexion')).toBeVisible();
      expect(router.state.location.href).toBe('/sign-in');
      await screen.unmount();
    }
  });

  test('never leads to another site', async () => {
    for (const destination of [
      'https://evil.example/',
      '//evil.example/',
      '/\\evil.example/',
      '/\t/evil.example/',
      '/\n/evil.example/',
      'javascript:alert(1)',
    ]) {
      const { screen, router } = await renderApp(
        `/sign-in?redirect=${encodeURIComponent(destination)}`,
        fakeApi({ ...signedOut, ...accepted }),
      );

      await fillSignIn(screen);

      await expect.element(heading(screen, "Aujourd'hui")).toBeVisible();
      expect(router.state.location.href).toBe('/today');
      await screen.unmount();
    }
  });

  test('with a session already, the sign-in screen leads straight to the page asked for', async () => {
    const { screen, router } = await renderApp('/sign-in?redirect=%2Fcontacts');

    await expect.element(heading(screen, 'Contacts')).toBeVisible();
    expect(router.state.location.pathname).toBe('/contacts');
  });
});

describe('signing out', () => {
  const signsOut = { [SIGN_OUT]: () => new Response(null, { status: 204 }) };

  test('from the sidebar: no confirmation, the device keeps nothing, back to signing in', async () => {
    const { screen, router, api, queryClient } = await renderApp('/contacts', fakeApi(signsOut));
    queryClient.setQueryData(['summary'], { contacts: ['Jane Doe'] });
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    await expect.element(menu.getByText('jane@example.com')).toBeVisible();

    await menu.getByRole('button', { name: 'Se déconnecter' }).click();

    await expect.element(heading(screen, 'Connexion')).toBeVisible();
    expect(router.state.location.href).toBe('/sign-in');
    expect(api.sent(SIGN_OUT)).toHaveLength(1);
    expect(queryClient.getQueryData(['summary'])).toBeUndefined();
    expect(queryClient.getQueryData(['session'])).toBeNull();
  });

  test('on a phone, from More', async () => {
    await page.viewport(390, 800);
    const { screen, router } = await renderApp('/more', fakeApi(signsOut));
    const more = screen.getByRole('main');
    await expect.element(more.getByText('jane@example.com')).toBeVisible();
    const button = more.getByRole('button', { name: 'Se déconnecter' });
    expect(button.element().getBoundingClientRect().height).toBeGreaterThanOrEqual(44);

    await button.click();

    await expect.element(heading(screen, 'Connexion')).toBeVisible();
    expect(router.state.location.pathname).toBe('/sign-in');
  });

  test('the next User of this device does not land on the page of the previous one', async () => {
    const { screen, router } = await renderApp('/contacts', fakeApi({ ...signsOut, ...accepted }));

    await screen
      .getByRole('navigation', { name: 'Menu principal' })
      .getByRole('button', { name: 'Se déconnecter' })
      .click();
    await fillSignIn(screen);

    await expect.element(heading(screen, "Aujourd'hui")).toBeVisible();
    expect(router.state.location.pathname).toBe('/today');
  });

  test('says when it failed, and stays signed in', async () => {
    const { screen, router } = await renderApp(
      '/contacts',
      fakeApi({ [SIGN_OUT]: () => new Response(null, { status: 500 }) }),
    );
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });

    await menu.getByRole('button', { name: 'Se déconnecter' }).click();

    await expect
      .element(menu.getByRole('alert'))
      .toHaveTextContent("Quelque chose n'a pas fonctionné. Réessaie dans un instant.");
    expect(router.state.location.pathname).toBe('/contacts');
  });
});

describe.each(['light', 'dark'] as const)('axe finds nothing in the %s theme', (scheme) => {
  beforeEach(() => commands.emulateColorScheme(scheme));

  test('on the sign-in form and its refusal', async () => {
    const { screen } = await renderApp('/sign-in', fakeApi({ ...signedOut, ...refused }));
    await expect.element(heading(screen, 'Connexion')).toBeVisible();
    await expectNoAxeViolations();

    await fillSignIn(screen);

    await expect.element(screen.getByRole('alert')).toBeVisible();
    await expectNoAxeViolations();
  });

  test('on the account of the sidebar and of More', async () => {
    const desktop = await renderApp('/today');
    await expect.element(desktop.screen.getByText('jane@example.com')).toBeVisible();
    await expectNoAxeViolations();
    await desktop.screen.unmount();

    await page.viewport(390, 800);
    const phone = await renderApp('/more');
    await expect
      .element(phone.screen.getByRole('main').getByText('jane@example.com'))
      .toBeVisible();
    await expectNoAxeViolations();
  });
});
