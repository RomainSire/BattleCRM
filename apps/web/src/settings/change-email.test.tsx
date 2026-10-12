import { beforeEach, describe, expect, test } from 'vitest';
import { commands, page } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi, signedOut } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';

const PASSWORD = 'correct horse battery staple';
const NEW_EMAIL = 'jane@new.example.com';
const ASK = 'POST /api/account/email';
const CONFIRM = 'POST /api/account/email/confirm';
const SESSIONS = 'GET /api/sessions';
const SENT = `Un lien vient de partir à ${NEW_EMAIL}. Ton adresse changera quand tu cliqueras dessus : il est valable 1 heure.`;

const withSessions = { [SESSIONS]: () => Response.json({ sessions: [] }) };
const sent = { ...withSessions, [ASK]: () => new Response(null, { status: 204 }) };
const refusedWith = (error: string, status: number) => ({
  ...withSessions,
  [ASK]: () => Response.json({ error }, { status }),
});

type Screen = Awaited<ReturnType<typeof renderApp>>['screen'];

const heading = (screen: Screen, name: string) => screen.getByRole('heading', { level: 1, name });
const form = (screen: Screen) => screen.getByRole('form', { name: 'E-mail' });
const address = (screen: Screen) => form(screen).getByLabelText('Nouvelle adresse e-mail');
const current = (screen: Screen) =>
  form(screen).getByLabelText('Mot de passe actuel', { exact: true });

async function change(screen: Screen, { email = NEW_EMAIL, password = PASSWORD } = {}) {
  await address(screen).fill(email);
  await current(screen).fill(password);
  await screen.getByRole('button', { name: "Changer d'e-mail" }).click();
}

beforeEach(() => page.viewport(1280, 800));

describe('changing the e-mail, in the Account section of Settings', () => {
  test('shows the current address, and says the change waits for a click', async () => {
    const { screen } = await renderApp('/settings', fakeApi(withSessions));

    await expect
      .element(screen.getByRole('heading', { level: 3, name: 'E-mail', exact: true }))
      .toBeVisible();
    await expect.element(screen.getByText('Ton adresse : jane@example.com')).toBeVisible();
    await expect
      .element(
        screen.getByText(
          'Le changement prend effet quand tu cliques sur le lien envoyé à la nouvelle adresse.',
        ),
      )
      .toBeVisible();
  });

  test('sends the new address with the current password, then says a link has left', async () => {
    const { screen, api } = await renderApp('/settings', fakeApi(sent));

    await change(screen);

    await expect.element(form(screen).getByRole('status')).toHaveTextContent(SENT);
    expect(api.sent(ASK)).toEqual([{ route: ASK, body: { password: PASSWORD, email: NEW_EMAIL } }]);
    await expect.element(address(screen)).toHaveValue('');
    await expect.element(current(screen)).toHaveValue('');
    await expect.element(address(screen)).not.toHaveAttribute('data-invalid');
    await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
    // Nothing has changed yet.
    await expect.element(screen.getByText('Ton adresse : jane@example.com')).toBeVisible();
  });

  test('a password manager is told what each field is', async () => {
    const { screen } = await renderApp('/settings', fakeApi(withSessions));

    await expect.element(address(screen)).toHaveAttribute('autocomplete', 'email');
    await expect.element(current(screen)).toHaveAttribute('autocomplete', 'current-password');
    await expect.element(current(screen)).toHaveAttribute('type', 'password');
  });

  test('a wrong password is said on its field, and leaves the device signed in', async () => {
    const { screen, router } = await renderApp(
      '/settings',
      fakeApi(refusedWith('wrong_password', 403)),
    );

    await change(screen);

    await expect.element(current(screen)).toBeInvalid();
    await expect.element(form(screen).getByText('Mot de passe incorrect.')).toBeVisible();
    expect(router.state.location.pathname).toBe('/settings');
    await expect.element(address(screen)).toHaveValue(NEW_EMAIL);
    await expect.element(form(screen).getByRole('status')).toBeEmptyDOMElement();
  });

  test('too many wrong passwords are said', async () => {
    const { screen } = await renderApp('/settings', fakeApi(refusedWith('too_many_attempts', 429)));

    await change(screen);

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('Trop de tentatives. Réessaie dans 15 minutes.');
  });

  test('a malformed address or a missing password is refused before any request', async () => {
    const { screen, api } = await renderApp('/settings', fakeApi(sent));

    await change(screen, { email: 'jane' });
    await expect.element(form(screen).getByText('Saisis une adresse e-mail valide.')).toBeVisible();

    await address(screen).fill(NEW_EMAIL);
    await current(screen).fill('');
    await screen.getByRole('button', { name: "Changer d'e-mail" }).click();

    await expect.element(current(screen)).toBeInvalid();
    expect(api.sent(ASK)).toEqual([]);
  });

  test('the address the User already has is refused before any request', async () => {
    const { screen, api } = await renderApp('/settings', fakeApi(sent));

    await change(screen, { email: ' Jane@Example.com ' });

    await expect.element(address(screen)).toBeInvalid();
    await expect.element(form(screen).getByText("C'est déjà ton adresse.")).toBeVisible();
    await expect.element(form(screen).getByRole('status')).toBeEmptyDOMElement();
    expect(api.sent(ASK)).toEqual([]);
  });

  test('says when the API failed, and never that a link has left', async () => {
    const { screen } = await renderApp(
      '/settings',
      fakeApi({ ...withSessions, [ASK]: () => new Response(null, { status: 500 }) }),
    );

    await change(screen);

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent("Quelque chose n'a pas fonctionné.");
    await expect.element(form(screen).getByRole('status')).toBeEmptyDOMElement();
  });

  test('on a phone, the field and every button are at least 44 px high', async () => {
    await page.viewport(390, 800);
    const { screen } = await renderApp('/settings', fakeApi(withSessions));
    await expect.element(address(screen)).toBeVisible();

    const targets = [address(screen).element(), ...form(screen).getByRole('button').elements()];
    expect(targets).toHaveLength(3);
    for (const target of targets) {
      expect(target.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  });
});

describe('the link sent to the new address', () => {
  test('sends its token, then shows the new address in Settings', async () => {
    const api = fakeApi({ ...withSessions, [CONFIRM]: () => Response.json({ email: NEW_EMAIL }) });
    const { screen, router } = await renderApp('/change-email#the-token', api);

    await expect.element(screen.getByText(`Ton adresse : ${NEW_EMAIL}`)).toBeVisible();
    expect(router.state.location.pathname).toBe('/settings');
    expect(api.sent(CONFIRM)).toEqual([{ route: CONFIRM, body: { token: 'the-token' } }]);
  });

  test('a link that has expired or already served says so, and leads back to Settings', async () => {
    const { screen, router } = await renderApp(
      '/change-email#old-token',
      fakeApi({
        ...withSessions,
        [CONFIRM]: () => Response.json({ error: 'invalid_link' }, { status: 400 }),
      }),
    );

    await expect.element(heading(screen, "Ce lien n'est plus valable")).toBeVisible();
    await screen.getByRole('link', { name: 'Refaire la demande dans les Réglages' }).click();

    await expect.element(heading(screen, 'Réglages')).toBeVisible();
    expect(router.state.location.pathname).toBe('/settings');
    await expect.element(screen.getByText('Ton adresse : jane@example.com')).toBeVisible();
  });

  test('a session ended from elsewhere leads to signing in, and back to the link', async () => {
    const api = fakeApi({
      [CONFIRM]: () => Response.json({ error: 'unauthenticated' }, { status: 401 }),
    });
    const { screen, router } = await renderApp('/change-email#the-token', api);

    await expect.element(heading(screen, 'Connexion')).toBeVisible();
    expect(router.state.location.search).toEqual({ redirect: '/change-email#the-token' });
  });

  test('opens no session: signing in comes first, and leads back to the link', async () => {
    const api = fakeApi({ ...signedOut, ...withSessions });
    const { screen, router } = await renderApp('/change-email#the-token', api);

    await expect.element(heading(screen, 'Connexion')).toBeVisible();

    expect(router.state.location.search).toEqual({ redirect: '/change-email#the-token' });
    expect(api.sent(CONFIRM)).toEqual([]);
  });
});

describe.each(['light', 'dark'] as const)('axe finds nothing in the %s theme', (scheme) => {
  // Before the first render: a colour measured during a transition would prove nothing.
  beforeEach(() => commands.emulateColorScheme(scheme));

  test.each([
    ['desktop', 1280],
    ['mobile', 390],
  ] as const)('on the e-mail form, refused then accepted, %s', async (_width, width) => {
    await page.viewport(width, 800);
    let attempts = 0;
    const { screen } = await renderApp(
      '/settings',
      fakeApi({
        ...withSessions,
        [ASK]: () => {
          attempts += 1;
          return attempts === 1
            ? Response.json({ error: 'wrong_password' }, { status: 403 })
            : new Response(null, { status: 204 });
        },
      }),
    );
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');

    await change(screen, { password: 'not the right password' });
    await expect.element(form(screen).getByText('Mot de passe incorrect.')).toBeVisible();
    await expectNoAxeViolations();

    await change(screen);
    await expect.element(form(screen).getByRole('status')).toHaveTextContent(SENT);
    await expectNoAxeViolations();
  });

  test('on a link that is no longer valid', async () => {
    await renderApp(
      '/change-email#old-token',
      fakeApi({ [CONFIRM]: () => Response.json({ error: 'invalid_link' }, { status: 400 }) }),
    );
    await expect
      .element(page.getByRole('heading', { level: 1, name: "Ce lien n'est plus valable" }))
      .toBeVisible();
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');

    await expectNoAxeViolations();
  });
});
