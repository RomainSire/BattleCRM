import { expect, installed, seed, test } from './support/fixtures.ts';

test('offline, the installed app opens on what the device kept, to read only', async ({
  page,
  context,
}) => {
  const outreach = await seed.stageId(page.request, 'Approche');
  const mail = await seed.positioning(page.request, outreach, 'Mail A');
  const claire = await seed.contact(page.request, {
    name: 'Claire Martin',
    status: 'prospecting',
    stageId: outreach,
  });
  await seed.sent(page.request, claire, mail, 10);

  // Online once: the service worker installs, and the device keeps the summary.
  await page.goto('/today');
  await expect(page.getByRole('main')).toContainText('Claire Martin');
  await installed(page);
  await expect(page.getByRole('main')).toContainText('Claire Martin');

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { level: 1, name: "Aujourd'hui" })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Hors ligne' }).first()).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Claire Martin' }).first().click();

  // The record, beside the list, reads; what would be sent at once waits for the connection.
  const record = page.getByRole('region', { name: 'Claire Martin' });
  await expect(record.getByRole('heading', { level: 2, name: 'Claire Martin' })).toBeVisible();
  await expect(record.getByRole('button', { name: 'Reporter la Relance' })).toBeDisabled();
  await expect(record.getByText('Le fil se charge avec la connexion.')).toBeVisible();
  await record.getByRole('button', { name: 'Relancer…' }).first().click();
  const followUp = page.getByRole('dialog', { name: 'Relancer Claire Martin' });
  await expect(followUp.getByRole('button', { name: 'Relancer' })).toBeDisabled();
  // Back online is the component tests': a page Firefox loaded offline hears no `online` under
  // Playwright's emulation, as it would on a real network.
});
