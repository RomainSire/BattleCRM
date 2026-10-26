import { expect, forgetRateLimits, test } from './support/fixtures.ts';
import { totp } from './support/totp.ts';

test('the second factor turned on in Settings, then asked at the next sign-in', async ({
  page,
  account,
}) => {
  await forgetRateLimits();
  await page.goto('/settings');
  const form = page.getByRole('form', { name: 'Double authentification' });
  await form.getByLabel('Mot de passe actuel', { exact: true }).fill(account.password);
  await form.getByRole('button', { name: 'Activer', exact: true }).click();

  // The key, as the authenticator app would read it from the QR code.
  await expect(page.getByRole('figure', { name: 'QR code de la clé' })).toBeVisible();
  const key = (await page.getByText(/^([A-Z2-7]{4} ?)+$/).textContent()) ?? '';
  await page.getByRole('textbox', { name: 'Code de confirmation' }).fill(totp(key));
  await page.getByRole('button', { name: 'Confirmer' }).click();

  const codes = page.getByRole('region', { name: 'Codes de secours' });
  await codes.getByText("J'ai mis mes codes en lieu sûr").click();
  await codes.getByRole('button', { name: 'Terminé' }).click();
  await expect(page.getByText('Activée. Codes de secours restants : 10.')).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Menu principal' })
    .getByRole('button', { name: 'Se déconnecter' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible();

  // The password proves half: the code opens the session.
  await page.getByRole('textbox', { name: 'E-mail' }).fill(account.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByRole('textbox', { name: 'Code' }).fill(totp(key));
  await page.getByRole('button', { name: 'Valider' }).click();

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { level: 1, name: "Aujourd'hui" })).toBeVisible();
});
