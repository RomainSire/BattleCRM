import { expect, seed, test } from './support/fixtures.ts';

const POOL = [
  'Hugo Blanc',
  'Zoé Garnier',
  'Yann Morel',
  'Inès Haddad',
  'Paul Simon',
  'Rose Lefèvre',
];

test('Today: a Contact of the Pool brought in from the Entries, an overdue Follow-up postponed, then “Undo”', async ({
  page,
}) => {
  const outreach = await seed.stageId(page.request, 'Approche');
  const mail = await seed.positioning(page.request, outreach, 'Mail A');
  const claire = await seed.contact(page.request, {
    name: 'Claire Martin',
    status: 'prospecting',
    stageId: outreach,
  });
  // Follow-up 1 was due 7 days ago.
  await seed.sent(page.request, claire, mail, 10);
  for (const name of POOL) await seed.contact(page.request, { name });

  await page.goto('/today');

  // The Entries, Claire's counted: a Contact of the Pool picked for the day enters the Funnel and
  // leaves the banner.
  const entries = page.getByRole('region', { name: /^Entrées/ });
  await expect(entries).toContainText('Entrées cette semaine 1/5');
  const first = entries.getByRole('listitem').first();
  const firstText = (await first.textContent()) ?? '';
  const pickedName = POOL.find((name) => firstText.includes(name)) ?? 'none of the Pool';
  await first.getByRole('button', { name: 'Faire entrer…' }).click();
  const bringIn = page.getByRole('dialog', { name: `Faire entrer ${pickedName}` });
  await bringIn.getByRole('combobox', { name: 'Étape' }).selectOption({ label: 'Approche' });
  await bringIn.getByRole('button', { name: 'Faire entrer' }).click();

  await expect(entries).toContainText('Entrées cette semaine 2/5');
  await expect(entries).not.toContainText(pickedName);
  await expect(entries.getByRole('button', { name: 'Faire entrer…' })).not.toHaveCount(0);

  // The overdue Follow-up: postponed by 3 days, it leaves the list; “Undo” brings it back.
  const due = page.getByRole('region', { name: /^Relances et Alliés à relancer/ });
  const row = due.getByRole('listitem').filter({ hasText: 'Claire Martin' });
  await row.getByRole('button', { name: 'Reporter' }).click();
  await page.getByRole('menuitem', { name: '+3 j' }).click();

  // Its only row gone, the list goes too.
  await expect(row).toBeHidden();
  await page
    .getByRole('alertdialog', { name: /^Relance de Claire Martin planifiée le/ })
    .getByRole('button', { name: 'Annuler' })
    .click();
  await expect(page.getByText('Annulé.')).toBeVisible();
  await expect(row).toBeVisible();
});
