import { get } from 'idb-keyval';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { fakeApi } from '../test/fake-api.ts';
import { renderApp } from '../test/render-app.tsx';
import { contact, summary } from '../test/summary.ts';
import { DEVICE_DATA_KEY } from './device-data.ts';

// The copy a device keeps for reading offline goes when its session does (ST-04).

const desktop = () => page.viewport(1280, 800);

/** The queries kept in IndexedDB, as the app reads them back on its next start. */
async function keptQueries(): Promise<unknown[]> {
  const persisted: { clientState: { queries: unknown[] } } | undefined = await get(DEVICE_DATA_KEY);
  return persisted?.clientState.queries ?? [];
}

const withJean = () => ({
  'GET /api/summary': () =>
    Response.json(summary({ contacts: [contact({ name: 'Jean Dupont' })] })),
});

test('signing out erases the copy kept on the device', async () => {
  await desktop();
  const { screen } = await renderApp(
    '/today',
    fakeApi({ ...withJean(), 'POST /api/auth/sign-out': () => new Response(null) }),
  );
  await expect.poll(keptQueries).toHaveLength(1);

  await screen.getByRole('button', { name: 'Se déconnecter' }).click();

  await expect.element(screen.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible();
  await expect.poll(keptQueries).toEqual([]);
});

test('a 401 of a session revoked from elsewhere erases the copy kept on the device', async () => {
  await desktop();
  const { screen } = await renderApp(
    '/today',
    fakeApi({
      ...withJean(),
      'GET /api/sessions': () => Response.json({ error: 'unauthenticated' }, { status: 401 }),
    }),
  );
  await expect.poll(keptQueries).toHaveLength(1);

  await screen
    .getByRole('navigation', { name: 'Menu principal' })
    .getByRole('link', { name: 'Réglages' })
    .click();

  await expect.element(screen.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible();
  await expect.poll(keptQueries).toEqual([]);
});
