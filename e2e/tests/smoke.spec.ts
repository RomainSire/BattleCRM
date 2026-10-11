import { expect, test } from '@playwright/test';

test('the API answers its health check through the edge', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', version: 'e2e' });
  expect(response.headers()['x-app-version']).toBe('e2e');
});

test('the SPA opens under the production headers, without a blocked resource', async ({ page }) => {
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.goto('/');

  const headers = response?.headers() ?? {};
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['strict-transport-security']).toContain('max-age=');
  expect(headers['x-content-type-options']).toBe('nosniff');
  // Nobody is signed in: the app leads to signing in, and the API says sign-ups are open here.
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible();
  await page.getByRole('link', { name: 'Créer un compte' }).click();
  await expect(page.getByRole('textbox', { name: 'E-mail' })).toBeVisible();
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
  expect(errors).toEqual([]);
});

test('a deep link serves the SPA, a missing asset does not', async ({ request }) => {
  const deepLink = await request.get('/contacts');
  expect(deepLink.status()).toBe(200);
  expect(deepLink.headers()['cache-control']).toBe('no-cache');
  expect(await deepLink.text()).toContain('<div id="root">');

  const asset = await request.get('/assets/missing.js');
  expect(asset.status()).toBe(404);
});

test('the landing host answers without content until the landing exists', async ({ request }) => {
  const response = await request.get('/', { headers: { Host: 'site.localhost' } });

  expect(response.status()).toBe(204);
  expect(response.headers()['strict-transport-security']).toContain('max-age=');
});

declare global {
  interface Window {
    /** Filled by the init script of the SPA test. */
    cspViolations: string[];
  }
}
