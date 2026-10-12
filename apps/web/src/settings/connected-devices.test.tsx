import { setLocale } from '@battlecrm/i18n/runtime';
import { beforeEach, describe, expect, test } from 'vitest';
import { commands, page } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';

const SESSIONS = 'GET /api/sessions';
const REVOKE_OTHERS = 'POST /api/sessions/revoke-others';
const revokeRoute = (id: string) => `POST /api/sessions/${id}/revoke`;

const laptop = {
  id: '0199d3a0-0000-7000-8000-000000000001',
  browser: 'Firefox',
  os: 'Linux',
  lastActiveAt: '2026-10-12T08:00:00.000Z',
  current: true,
};
const phone = {
  id: '0199d3a0-0000-7000-8000-000000000002',
  browser: 'Safari',
  os: 'iOS',
  lastActiveAt: '2026-10-10T12:00:00.000Z',
  current: false,
};
const unnamed = {
  id: '0199d3a0-0000-7000-8000-000000000003',
  browser: null,
  os: null,
  lastActiveAt: '2026-09-28T12:00:00.000Z',
  current: false,
};

/** An API that knows these sessions, and forgets the ones the SPA ends. */
function withSessions(...initial: (typeof laptop | typeof unnamed)[]) {
  let sessions = initial;
  return fakeApi({
    [SESSIONS]: () => Response.json({ sessions }),
    [REVOKE_OTHERS]: () => {
      sessions = sessions.filter((session) => session.current);
      return new Response(null, { status: 204 });
    },
    ...Object.fromEntries(
      initial.map(({ id }) => [
        revokeRoute(id),
        () => {
          sessions = sessions.filter((session) => session.id !== id);
          return new Response(null, { status: 204 });
        },
      ]),
    ),
  });
}

type Screen = Awaited<ReturnType<typeof renderApp>>['screen'];

const devices = (screen: Screen) => screen.getByRole('list', { name: 'Appareils connectés' });

beforeEach(() => page.viewport(1280, 800));

describe('connected devices, in the Account section of Settings', () => {
  test('lists them: browser and system, this device told apart, last activity of the others', async () => {
    const { screen } = await renderApp('/settings', withSessions(laptop, phone, unnamed));

    await expect.element(screen.getByRole('heading', { level: 2, name: 'Compte' })).toBeVisible();
    await expect
      .element(screen.getByRole('heading', { level: 3, name: 'Appareils connectés' }))
      .toBeVisible();
    const items = devices(screen).getByRole('listitem');
    const [first, second, third] = [items.nth(0), items.nth(1), items.nth(2)];
    await expect.element(first).toHaveTextContent('Firefox · Linux');
    await expect.element(first).toHaveTextContent('Cet appareil');
    await expect.element(first).not.toHaveTextContent('Dernière activité');
    await expect.element(second).toHaveTextContent('Safari · iOS');
    await expect.element(second).toHaveTextContent('Dernière activité : 10 oct. 2026');
    await expect.element(third).toHaveTextContent('Navigateur inconnu · Système inconnu');
    await expect.element(third).toHaveTextContent('Dernière activité : 28 sept. 2026');
  });

  test('this device has no “Sign out” of its own: the others have one each', async () => {
    const { screen } = await renderApp('/settings', withSessions(laptop, phone, unnamed));

    await expect
      .element(screen.getByRole('button', { name: 'Déconnecter Safari · iOS' }))
      .toBeVisible();
    await expect
      .element(
        screen.getByRole('button', { name: 'Déconnecter Navigateur inconnu · Système inconnu' }),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Déconnecter Firefox · Linux' }))
      .not.toBeInTheDocument();
  });

  test('“Sign out” ends that session, without a confirmation, and the list follows', async () => {
    const api = withSessions(laptop, phone, unnamed);
    const { screen } = await renderApp('/settings', api);

    await screen.getByRole('button', { name: 'Déconnecter Safari · iOS' }).click();

    await expect.element(devices(screen).getByText('Safari · iOS')).not.toBeInTheDocument();
    expect(api.sent(revokeRoute(phone.id))).toHaveLength(1);
    await expect.element(devices(screen).getByRole('listitem')).toHaveLength(2);
  });

  test('“Sign out all the others” keeps this device only', async () => {
    const api = withSessions(laptop, phone, unnamed);
    const { screen } = await renderApp('/settings', api);

    await screen.getByRole('button', { name: 'Déconnecter tous les autres' }).click();

    await expect.element(devices(screen).getByRole('listitem')).toHaveLength(1);
    expect(api.sent(REVOKE_OTHERS)).toHaveLength(1);
    await expect.element(devices(screen)).toHaveTextContent('Firefox · Linux');
    await expect
      .element(screen.getByRole('button', { name: 'Déconnecter tous les autres' }))
      .not.toBeInTheDocument();
  });

  test('with this device alone, there is nothing to sign out', async () => {
    const { screen } = await renderApp('/settings', withSessions(laptop));

    await expect.element(devices(screen)).toHaveTextContent('Firefox · Linux');
    await expect
      .element(screen.getByRole('main').getByRole('button', { name: /^Déconnecter/ }))
      .not.toBeInTheDocument();
  });

  test('a session that was already gone is no error: the list follows', async () => {
    let sessions = [laptop, phone];
    const api = fakeApi({
      [SESSIONS]: () => Response.json({ sessions }),
      [revokeRoute(phone.id)]: () => {
        sessions = [laptop];
        return Response.json({ error: 'not_found' }, { status: 404 });
      },
    });
    const { screen } = await renderApp('/settings', api);

    await screen.getByRole('button', { name: 'Déconnecter Safari · iOS' }).click();

    await expect.element(devices(screen).getByRole('listitem')).toHaveLength(1);
    await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
  });

  test('says when signing a device out failed, and keeps it listed', async () => {
    const api = fakeApi({
      [SESSIONS]: () => Response.json({ sessions: [laptop, phone] }),
      [revokeRoute(phone.id)]: () => new Response(null, { status: 500 }),
      [REVOKE_OTHERS]: () => new Response(null, { status: 500 }),
    });
    const { screen } = await renderApp('/settings', api);

    await screen.getByRole('button', { name: 'Déconnecter Safari · iOS' }).click();

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent("Quelque chose n'a pas fonctionné. Réessaie dans un instant.");
    await expect.element(devices(screen).getByText('Safari · iOS')).toBeVisible();

    await screen.getByRole('button', { name: 'Déconnecter tous les autres' }).click();

    await expect.element(screen.getByRole('alert')).toBeVisible();
    await expect.element(devices(screen).getByText('Safari · iOS')).toBeVisible();
  });

  test('says when the list could not be read', async () => {
    const { screen } = await renderApp(
      '/settings',
      fakeApi({ [SESSIONS]: () => new Response(null, { status: 500 }) }),
    );

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent("Quelque chose n'a pas fonctionné. Réessaie dans un instant.");
  });

  test('speaks English when the locale is English', async () => {
    await setLocale('en', { reload: false });
    const { screen } = await renderApp('/settings', withSessions(laptop, phone, unnamed));

    await expect.element(screen.getByRole('heading', { level: 2, name: 'Account' })).toBeVisible();
    const list = screen.getByRole('list', { name: 'Connected devices' });
    await expect.element(list).toHaveTextContent('This device');
    await expect.element(list).toHaveTextContent('Last active: Oct 10, 2026');
    await expect.element(list).toHaveTextContent('Unknown browser · Unknown system');
    await expect
      .element(screen.getByRole('button', { name: 'Sign out Safari · iOS' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Sign out all the others' }))
      .toBeVisible();
  });

  test('on a phone, every button is at least 44 px high', async () => {
    await page.viewport(390, 800);
    const { screen } = await renderApp('/settings', withSessions(laptop, phone));
    await expect.element(devices(screen)).toHaveTextContent('Safari · iOS');

    const buttons = [
      ...devices(screen).getByRole('button').elements(),
      ...screen.getByRole('button', { name: 'Déconnecter tous les autres' }).elements(),
    ];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  });
});

describe('a device whose session was ended from elsewhere (ST-04)', () => {
  const SIGN_IN = 'POST /api/auth/sign-in/email';

  /** The API of a device signed out remotely: every call answers 401 until it signs in again. */
  function revokedUntilSignIn() {
    let revoked = true;
    return fakeApi({
      [SESSIONS]: () =>
        revoked
          ? Response.json({ error: 'unauthenticated' }, { status: 401 })
          : Response.json({ sessions: [laptop] }),
      [SIGN_IN]: () => {
        revoked = false;
        return Response.json({ email: 'jane@example.com' });
      },
    });
  }

  test('erases what the device kept at its first 401, then asks to sign in again', async () => {
    const { screen, router, queryClient } = await renderApp('/today', revokedUntilSignIn());
    await expect
      .element(screen.getByRole('heading', { level: 1 }))
      .toHaveTextContent("Aujourd'hui");
    queryClient.setQueryData(['summary'], { contacts: ['Jane Doe'] });

    await screen
      .getByRole('navigation', { name: 'Menu principal' })
      .getByRole('link', { name: 'Réglages' })
      .click();

    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Connexion' }))
      .toBeVisible();
    expect(queryClient.getQueryData(['summary'])).toBeUndefined();
    expect(queryClient.getQueryData(['session'])).toBeNull();
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(router.state.location.search).toEqual({ redirect: '/settings' });
  });

  test('signing in again leads back to the page it was on', async () => {
    const { screen, router } = await renderApp('/settings', revokedUntilSignIn());
    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Connexion' }))
      .toBeVisible();

    await screen.getByRole('textbox', { name: 'E-mail' }).fill('jane@example.com');
    await screen.getByLabelText('Mot de passe', { exact: true }).fill('correct horse battery');
    await screen.getByRole('button', { name: 'Se connecter' }).click();

    await expect.element(devices(screen)).toHaveTextContent('Firefox · Linux');
    expect(router.state.location.pathname).toBe('/settings');
  });

  test('a refused sign-in is no ended session: its message stays', async () => {
    const { screen, router } = await renderApp(
      '/sign-in',
      fakeApi({
        'GET /api/session': () => Response.json({ error: 'unauthenticated' }, { status: 401 }),
        [SIGN_IN]: () => Response.json({ error: 'invalid_credentials' }, { status: 401 }),
      }),
    );

    await screen.getByRole('textbox', { name: 'E-mail' }).fill('jane@example.com');
    await screen.getByLabelText('Mot de passe', { exact: true }).fill('wrong');
    await screen.getByRole('button', { name: 'Se connecter' }).click();

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('Adresse e-mail ou mot de passe incorrect.');
    expect(router.state.location.href).toBe('/sign-in');
  });
});

describe.each(['light', 'dark'] as const)('axe finds nothing in the %s theme', (scheme) => {
  beforeEach(() => commands.emulateColorScheme(scheme));

  test('on the connected devices, on desktop and on a phone', async () => {
    const desktop = await renderApp('/settings', withSessions(laptop, phone, unnamed));
    await expect.element(devices(desktop.screen)).toHaveTextContent('Safari · iOS');
    await expectNoAxeViolations();
    await desktop.screen.unmount();

    await page.viewport(390, 800);
    const mobile = await renderApp('/settings', withSessions(laptop, phone, unnamed));
    await expect.element(devices(mobile.screen)).toHaveTextContent('Safari · iOS');
    await expectNoAxeViolations();
  });
});
