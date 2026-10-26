import type { Page } from '@playwright/test';

import { expect, seed, test } from './support/fixtures.ts';

/** The grid of a Stage, and the card of a Contact in it. */
const column = (page: Page, name: string) => page.getByRole('grid', { name });
const card = (page: Page, name: string) => page.getByRole('row', { name: new RegExp(name) });

test.beforeEach(async ({ page }) => {
  const outreach = await seed.stageId(page.request, 'Approche');
  await seed.contact(page.request, { name: 'Marc Roy', status: 'prospecting', stageId: outreach });
  await seed.contact(page.request, { name: 'Léa Petit', status: 'prospecting', stageId: outreach });
  await page.goto('/funnel');
  await expect(column(page, 'Approche')).toContainText('Marc Roy');
});

/** Validated, the card stays in its new column, on the server too. */
async function expectMoved(page: Page) {
  await expect(column(page, 'Qualif ESN')).toContainText('Marc Roy');
  await page.reload();
  await expect(column(page, 'Qualif ESN')).toContainText('Marc Roy');
  await expect(column(page, 'Approche')).not.toContainText('Marc Roy');
}

test('a card dragged with the mouse onto another column changes its Stage', async ({ page }) => {
  await card(page, 'Marc Roy').dragTo(column(page, 'Qualif ESN'));

  const dialog = page.getByRole('dialog', { name: "Changer Marc Roy d'Étape" });
  await expect(dialog.getByRole('combobox', { name: 'Nouvelle Étape' })).toHaveText(
    /Avancer à Qualif ESN/,
  );
  await dialog.getByRole('button', { name: "Changer d'Étape" }).click();

  await expectMoved(page);
});

test('a card moved with the keyboard alone changes its Stage, and “Undo” moves it back', async ({
  page,
}) => {
  // From the top of the page: the skip link, then the content.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();
  await page.keyboard.press('Enter');
  // A column is a single stop of Tab, on its first card; the arrows go from card to card.
  await pressUntil(page, 'Tab', () => column(page, 'Approche').evaluate(hasFocusWithin));
  await pressUntil(page, 'ArrowDown', () => card(page, 'Marc Roy').evaluate(isFocused));
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Déplacer Marc Roy' })).toBeFocused();
  await page.keyboard.press('Enter');
  // Tab goes from drop target to drop target, up to the column of Qualif ESN.
  await pressUntil(page, 'Tab', () => column(page, 'Qualif ESN').evaluate(hasFocusWithin));
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: "Changer Marc Roy d'Étape" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: "Changer d'Étape" })).toBeEnabled();
  await page.keyboard.press('Control+Enter');
  await expect(dialog).toBeHidden();
  await expect(column(page, 'Qualif ESN')).toContainText('Marc Roy');

  // The notification is reached from the keyboard too: Ctrl Z, outside any field.
  await page.keyboard.press('Control+z');
  await expect(page.getByText('Annulé.')).toBeVisible();
  await expect(column(page, 'Approche')).toContainText('Marc Roy');
  await page.reload();
  await expect(column(page, 'Approche')).toContainText('Marc Roy');
});

/** Presses `key` until `done`, a few times at most. */
async function pressUntil(page: Page, key: string, done: () => Promise<boolean>) {
  for (let presses = 0; presses < 10 && !(await done()); presses += 1) {
    await page.keyboard.press(key);
  }
  expect(await done(), `${key} never got there`).toBe(true);
}

const isFocused = (element: Element) => element === document.activeElement;
const hasFocusWithin = (element: Element) => element.contains(document.activeElement);
