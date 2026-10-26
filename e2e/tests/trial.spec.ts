import { expect, seed, test } from './support/fixtures.ts';

test('a Contact, a Battle at its Stage, the assigned Positioning sent as an Interaction, then “Undo”', async ({
  page,
}) => {
  const outreach = await seed.stageId(page.request, 'Approche');
  await seed.positioning(page.request, outreach, 'Mail A');
  await seed.positioning(page.request, outreach, 'Mail B');

  // The Battle: Mail A defends, Mail B challenges.
  await page.goto('/battles');
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Approche' })
    .getByRole('button', { name: 'Ouvrir une Battle…' })
    .click();
  const wizard = page.getByRole('dialog', { name: 'Ouvrir une Battle · Approche' });
  await wizard.getByRole('radiogroup', { name: 'Champion initial' }).getByText('Mail A').click();
  await wizard.getByRole('radiogroup', { name: 'Challenger' }).getByText('Mail B').click();
  await wizard.getByRole('button', { name: 'Suivant' }).click();
  await wizard.getByRole('textbox', { name: 'Critère de succès' }).fill('a demandé le CV');
  await wizard.getByRole('button', { name: 'Suivant' }).click();
  await wizard.getByRole('button', { name: 'Ouvrir la Battle' }).click();
  await expect(page.getByText('Battle ouverte à Approche : Mail A vs Mail B.')).toBeVisible();

  // The Contact, added Prospecting at the first Stage, and straight on to sending it something.
  await page.getByRole('main').click();
  await page.keyboard.press('n');
  await page.getByRole('dialog').getByRole('textbox', { name: 'Nom' }).fill('Nina Roux');
  await page.keyboard.press('Control+Enter');

  const send = page.getByRole('dialog', { name: 'Envoyer à Nina Roux' });
  await expect(send).toContainText('tiré au sort');
  await expect(send).toContainText('Essai commencé');
  await send.getByRole('button', { name: "C'est envoyé" }).click();

  const sent = page.getByRole('alertdialog', {
    name: /^Envoyé à Nina Roux : « Mail [AB] », Essai commencé\./,
  });
  await expect(sent).toBeVisible();
  await expect(send).toBeHidden();
  const followUp = page.getByRole('region', { name: 'Relance 1' });
  await expect(followUp).toBeVisible();

  // The notification takes it all back, on the server.
  await sent.getByRole('button', { name: 'Annuler' }).click();

  await expect(page.getByText('Annulé.')).toBeVisible();
  await expect(followUp).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Nina Roux' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Relance 1' })).toBeHidden();
});
