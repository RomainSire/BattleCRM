import type { BrowserContext, Page } from '@playwright/test';

import { expect, installed, test } from './support/fixtures.ts';

const NEXT = 'e2e-next';

/** The script of the build the page runs: each release has its own. */
const bundle = () => document.querySelector<HTMLScriptElement>('script[type=module]')?.src;

/**
 * A release while the app is open: the edge now serves the next build of the SPA (compose.e2e.yml),
 * whose service worker differs, and the API answers as the next version from its next request.
 */
async function release(page: Page, context: BrowserContext) {
  await context.addCookies([{ name: 'e2e-release', value: 'next', url: page.url() }]);
  await context.route('**/api/**', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'x-app-version': NEXT } });
  });
}

/** The app hears of it, offers it without ever reloading by itself, and reloads on it when asked. */
async function expectOfferTaken(page: Page, build: string | undefined) {
  await page
    .getByRole('navigation', { name: 'Menu principal' })
    .getByRole('link', { name: 'Contacts' })
    .click();

  const offer = page.getByRole('status').filter({ hasText: 'Nouvelle version disponible' });
  await expect(offer).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Contacts' })).toBeVisible();
  expect(await page.evaluate(bundle)).toBe(build);

  await Promise.all([
    page.waitForEvent('load'),
    offer.getByRole('button', { name: 'Recharger' }).click(),
  ]);

  await expect(page.getByRole('heading', { level: 1, name: 'Contacts' })).toBeVisible();
  expect(await page.evaluate(bundle)).not.toBe(build);
  await expect(offer).toBeHidden();
}

test('an API of another version: the app offers the new one, and reloads on it only when asked', async ({
  page,
  context,
}) => {
  await page.goto('/today');
  await installed(page);
  const build = await page.evaluate(bundle);

  await release(page, context);

  await expectOfferTaken(page, build);
});

test('on the very first visit too, before the service worker has the page', async ({
  page,
  context,
}) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect(page.getByRole('heading', { level: 1, name: "Aujourd'hui" })).toBeVisible();
  const build = await page.evaluate(bundle);

  await release(page, context);

  await expectOfferTaken(page, build);
});
