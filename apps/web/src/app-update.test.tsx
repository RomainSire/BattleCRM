import type { QueryClient } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';

import { fakeApi } from '../test/fake-api.ts';
import { renderApp } from '../test/render-app.tsx';
import { summary } from '../test/summary.ts';
import { APP_VERSION, appUpdate } from './app-update.tsx';
import { SUMMARY_KEY } from './summary.ts';

// A new version is offered, never forced (spec stack §3).

/** The service worker as the app registers it: a check for a new version, and taking it. */
function registeredWorker() {
  const worker = {
    lookForUpdate: vi.fn<() => Promise<unknown>>(async () => undefined),
    takeUpdate: vi.fn<() => Promise<unknown>>(async () => undefined),
  };
  appUpdate.registered(worker);
  return worker;
}

/** An API that answers as `version` of the app does. */
const apiOf = (version: string) =>
  fakeApi({
    'GET /api/summary': () => Response.json(summary(), { headers: { 'X-App-Version': version } }),
  });

/**
 * Waits until the summary is read, hence its `X-App-Version` heard. Not the heading: Today shows it
 * while the summary is still on its way.
 */
async function summaryRead(queryClient: QueryClient) {
  await expect.poll(() => queryClient.getQueryData(SUMMARY_KEY)).toBeDefined();
}

test('an API of another version makes the app look for it once, then offer to reload, which it never does by itself', async () => {
  const worker = registeredWorker();

  const { screen } = await renderApp('/today', apiOf('9.9.9'));

  await expect.poll(() => worker.lookForUpdate).toHaveBeenCalledTimes(1);
  // The new version is ready: the service worker says so.
  appUpdate.available();
  const notice = screen.getByRole('status').filter({ hasText: 'Nouvelle version disponible.' });
  await expect.element(notice).toBeVisible();
  expect(worker.takeUpdate).not.toHaveBeenCalled();

  await notice.getByRole('button', { name: 'Recharger' }).click();
  expect(worker.takeUpdate).toHaveBeenCalledTimes(1);
});

test('an API of this very version looks for nothing and offers nothing', async () => {
  const worker = registeredWorker();

  const { screen, queryClient } = await renderApp('/today', apiOf(APP_VERSION));

  await summaryRead(queryClient);
  expect(worker.lookForUpdate).not.toHaveBeenCalled();
  expect(screen.getByText('Nouvelle version disponible.').elements()).toEqual([]);
});

test('a version heard before the service worker is registered is looked for once it is', async () => {
  const { queryClient } = await renderApp('/today', apiOf('9.9.9'));
  await summaryRead(queryClient);

  const worker = registeredWorker();

  expect(worker.lookForUpdate).toHaveBeenCalledTimes(1);
});
