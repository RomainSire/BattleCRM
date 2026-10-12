import { beforeEach, describe, expect, test } from 'vitest';
import { commands, page } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';

const CURRENT = 'correct horse battery staple';
const NEW = 'a brand new passphrase';
const CHANGE = 'POST /api/account/password';
const SESSIONS = 'GET /api/sessions';

const thisDevice = {
  id: '0199d3a0-0000-7000-8000-000000000001',
  browser: 'Firefox',
  os: 'Linux',
  lastActiveAt: '2026-10-12T08:00:00.000Z',
  current: true,
};
const phone = { ...thisDevice, id: '0199d3a0-0000-7000-8000-000000000002', current: false };

const withSessions = { [SESSIONS]: () => Response.json({ sessions: [thisDevice] }) };
const changed = { ...withSessions, [CHANGE]: () => new Response(null, { status: 204 }) };
const refusedWith = (error: string, status: number) => ({
  ...withSessions,
  [CHANGE]: () => Response.json({ error }, { status }),
});

type Screen = Awaited<ReturnType<typeof renderApp>>['screen'];

const form = (screen: Screen) => screen.getByRole('form', { name: 'Mot de passe' });
const current = (screen: Screen) => screen.getByLabelText('Mot de passe actuel', { exact: true });
const next = (screen: Screen) => screen.getByLabelText('Nouveau mot de passe', { exact: true });

async function change(screen: Screen, { password = CURRENT, newPassword = NEW } = {}) {
  await current(screen).fill(password);
  await next(screen).fill(newPassword);
  await screen.getByRole('button', { name: 'Changer le mot de passe' }).click();
}

beforeEach(() => page.viewport(1280, 800));

describe('changing the password, in the Account section of Settings', () => {
  test('sends the current password with the new one, then says the other devices are signed out', async () => {
    const { screen, api } = await renderApp('/settings', fakeApi(changed));
    await expect
      .element(screen.getByRole('heading', { level: 3, name: 'Mot de passe', exact: true }))
      .toBeVisible();

    await change(screen);

    await expect
      .element(form(screen).getByRole('status'))
      .toHaveTextContent('Mot de passe changé. Tes autres appareils sont déconnectés.');
    expect(api.sent(CHANGE)).toEqual([
      { route: CHANGE, body: { password: CURRENT, newPassword: NEW } },
    ]);
    await expect.element(current(screen)).toHaveValue('');
    await expect.element(next(screen)).toHaveValue('');
    await expect.element(next(screen)).not.toHaveAttribute('data-invalid');
    await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
  });

  test('the list of connected devices is read again: the others are gone', async () => {
    let sessions = [thisDevice, phone];
    const { screen } = await renderApp(
      '/settings',
      fakeApi({
        [SESSIONS]: () => Response.json({ sessions }),
        [CHANGE]: () => {
          sessions = [thisDevice];
          return new Response(null, { status: 204 });
        },
      }),
    );
    const devices = screen.getByRole('list', { name: 'Appareils connectés' });
    await expect.element(devices.getByRole('listitem').nth(1)).toBeVisible();

    await change(screen);

    await expect.element(devices.getByRole('listitem').nth(1)).not.toBeInTheDocument();
  });

  test('a password manager tells the current password from the new one', async () => {
    const { screen } = await renderApp('/settings', fakeApi(withSessions));

    await expect.element(current(screen)).toHaveAttribute('autocomplete', 'current-password');
    await expect.element(next(screen)).toHaveAttribute('autocomplete', 'new-password');
    await expect.element(current(screen)).toHaveAttribute('type', 'password');
    await expect.element(next(screen)).toHaveAttribute('type', 'password');
  });

  test('a wrong current password is said on its field, and leaves the device signed in', async () => {
    const { screen, router } = await renderApp(
      '/settings',
      fakeApi(refusedWith('wrong_password', 403)),
    );

    await change(screen);

    await expect.element(current(screen)).toBeInvalid();
    await expect.element(form(screen).getByText('Mot de passe incorrect.')).toBeVisible();
    expect(router.state.location.pathname).toBe('/settings');
    await expect.element(current(screen)).toHaveValue(CURRENT);
    await expect.element(next(screen)).toHaveValue(NEW);
    await expect.element(form(screen).getByRole('status')).toBeEmptyDOMElement();
  });

  test('too many wrong passwords are said', async () => {
    const { screen } = await renderApp('/settings', fakeApi(refusedWith('too_many_attempts', 429)));

    await change(screen);

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('Trop de tentatives. Réessaie dans 15 minutes.');
  });

  test('a new password known to have leaked gets the sentence of the spec, on its field', async () => {
    const { screen } = await renderApp(
      '/settings',
      fakeApi(refusedWith('password_compromised', 400)),
    );

    await change(screen);

    await expect.element(next(screen)).toBeInvalid();
    await expect
      .element(
        screen.getByText(
          'Ce mot de passe apparaît dans des fuites de données connues, choisis-en un autre.',
        ),
      )
      .toBeVisible();
  });

  test('a new password under 15 characters is refused before any request', async () => {
    const { screen, api } = await renderApp('/settings', fakeApi(changed));

    await change(screen, { newPassword: 'fourteen chars' });

    await expect.element(next(screen)).toBeInvalid();
    expect(api.sent(CHANGE)).toEqual([]);
  });

  test('says when the password could not be checked, or when the API failed', async () => {
    const unavailable = await renderApp(
      '/settings',
      fakeApi(refusedWith('password_check_unavailable', 503)),
    );
    await change(unavailable.screen);
    await expect
      .element(unavailable.screen.getByRole('alert'))
      .toHaveTextContent("Ce mot de passe n'a pas pu être vérifié pour le moment.");
    await unavailable.screen.unmount();

    const broken = await renderApp(
      '/settings',
      fakeApi({ ...withSessions, [CHANGE]: () => new Response(null, { status: 500 }) }),
    );
    await change(broken.screen);
    await expect
      .element(broken.screen.getByRole('alert'))
      .toHaveTextContent("Quelque chose n'a pas fonctionné.");
  });

  test('on a phone, every button is at least 44 px high', async () => {
    await page.viewport(390, 800);
    const { screen } = await renderApp('/settings', fakeApi(withSessions));
    await expect.element(current(screen)).toBeVisible();

    const buttons = form(screen).getByRole('button').elements();
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  });
});

describe.each(['light', 'dark'] as const)('axe finds nothing in the %s theme', (scheme) => {
  // Before the first render: a colour measured during a transition would prove nothing.
  beforeEach(() => commands.emulateColorScheme(scheme));

  test.each([
    ['desktop', 1280],
    ['mobile', 390],
  ] as const)('on the password form, refused then accepted, %s', async (_width, width) => {
    await page.viewport(width, 800);
    let attempts = 0;
    const { screen } = await renderApp(
      '/settings',
      fakeApi({
        ...withSessions,
        [CHANGE]: () => {
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
    await expect
      .element(form(screen).getByRole('status'))
      .toHaveTextContent('Mot de passe changé.');
    await expectNoAxeViolations();
  });
});
