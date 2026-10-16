import { addDays, localDay, mondayOf } from '@battlecrm/domain';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import { settings as newUserSettings, summary } from '../../test/summary.ts';
import type { SummarySettings } from '../summary.ts';

const desktop = () => page.viewport(1280, 800);
const phone = () => page.viewport(390, 844);

const TIME_ZONE = 'Europe/Paris';
const SETTINGS_ROUTE = 'POST /api/settings';

/** What the SPA sends to save settings: only what changes. */
const settingsChange = z.strictObject({
  locale: z.enum(['fr', 'en']).optional(),
  timeZone: z.string().optional(),
  activityGoal: z.int().nullable().optional(),
  entryGoal: z.int().nullable().optional(),
  celebrateGoal: z.boolean().optional(),
  singleKeyShortcuts: z.boolean().optional(),
  checkInRhythmDays: z.int().optional(),
  circleSizeGoal: z.int().nullable().optional(),
  defaultCadence: z
    .strictObject({ intervals: z.array(z.int()), responseWindowDays: z.int() })
    .optional(),
});

/** An API that saves settings as the server does: only what is sent, the dated ones as chosen. */
function settingsApi(start: Partial<SummarySettings> = {}) {
  // A new User's Settings (CONTEXT.md), changed by what the test starts from.
  let settings = newUserSettings(start, TIME_ZONE);
  return fakeApi({
    'GET /api/summary': () => Response.json(summary({ timeZone: TIME_ZONE, settings })),
    [SETTINGS_ROUTE]: (body) => {
      const { activityGoal, entryGoal, timeZone, ...rest } = settingsChange.parse(body);
      // A key left out is absent from what Zod parsed, never `undefined`.
      settings = Object.assign({ ...settings }, rest, {
        ...(activityGoal !== undefined && {
          activityGoal: { ...settings.activityGoal, chosen: activityGoal },
        }),
        ...(entryGoal !== undefined && {
          entryGoal: { ...settings.entryGoal, chosen: entryGoal },
        }),
        ...(timeZone !== undefined && {
          timeZone: { ...settings.timeZone, chosen: timeZone },
        }),
      });
      return Response.json({ settings });
    },
  });
}

/** Ticks or unticks a box by its text, as a User does: the box itself is drawn over the input. */
const tick = (label: string) => page.getByText(label, { exact: true }).click();

const sentSettings = (api: ReturnType<typeof fakeApi>) =>
  api.sent(SETTINGS_ROUTE).map(({ body }) => body);

test('Settings has a column of anchors and a section each, with the defaults of a new User', async () => {
  await desktop();
  await renderApp('/settings', settingsApi());

  const anchors = page.getByRole('navigation', { name: 'Sections des réglages' });
  await expect
    .element(anchors.getByRole('link', { name: 'Prospection' }))
    .toHaveAttribute('href', '#prospecting');
  await expect.element(anchors.getByRole('link', { name: 'Préférences' })).toBeVisible();
  await expect.element(anchors.getByRole('link', { name: 'Compte' })).toBeVisible();
  const prospecting = page.getByRole('region', { name: 'Prospection' });
  await expect
    .element(prospecting.getByRole('checkbox', { name: "Objectif d'activité" }))
    .toBeChecked();
  await expect
    .element(prospecting.getByRole('textbox', { name: 'Actions de prospection par jour' }))
    .toHaveValue('1');
  await expect
    .element(prospecting.getByRole('textbox', { name: 'Entrées dans le Funnel par semaine' }))
    .toHaveValue('5');
  await expect
    .element(prospecting.getByRole('textbox', { name: 'Rythme des Alliés, en jours' }))
    .toHaveValue('28');
  await expect
    .element(prospecting.getByRole('textbox', { name: 'Alliés', exact: true }))
    .toHaveValue('10');
  await expect
    .element(prospecting.getByRole('textbox', { name: 'Relance 3, en jours' }))
    .toHaveValue('14');
  const preferences = page.getByRole('region', { name: 'Préférences' });
  await expect.element(preferences.getByRole('combobox', { name: 'Langue' })).toHaveValue('fr');
  await expect
    .element(preferences.getByRole('combobox', { name: 'Fuseau horaire' }))
    .toHaveValue(TIME_ZONE);
  await expect
    .element(preferences.getByRole('checkbox', { name: 'Raccourcis à une touche' }))
    .toBeChecked();
  await expect
    .element(preferences.getByText('« Réduire les animations » suit le réglage de ton système.'))
    .toBeVisible();
  await expectNoAxeViolations();
});

test('turning the Activity goal off saves at once, greys the celebration out, and “Undo” writes it back', async () => {
  await desktop();
  const api = settingsApi();
  await renderApp('/settings', api);
  const goal = page.getByRole('checkbox', { name: "Objectif d'activité" });
  await expect.element(page.getByText("S'applique à partir de demain.").first()).toBeVisible();

  await tick("Objectif d'activité");

  await expect.element(page.getByText("Réglage enregistré : Objectif d'activité")).toBeVisible();
  expect(sentSettings(api)).toEqual([{ activityGoal: null }]);
  await expect.element(goal).not.toBeChecked();
  await expect
    .element(page.getByRole('checkbox', { name: "Célébrer l'Objectif atteint" }))
    .toBeDisabled();
  await expect.element(page.getByText("Sans Objectif d'activité, rien à célébrer.")).toBeVisible();

  await page.getByRole('button', { name: /^Annuler$/ }).click();

  await expect.element(page.getByText('Annulé.')).toBeVisible();
  expect(sentSettings(api)).toEqual([{ activityGoal: null }, { activityGoal: 1 }]);
  await expect.element(goal).toBeChecked();
  await expect
    .element(page.getByRole('checkbox', { name: "Célébrer l'Objectif atteint" }))
    .toBeEnabled();
});

test('a number saves once committed, and the Entry goal says which Monday it applies from', async () => {
  await desktop();
  const api = settingsApi();
  await renderApp('/settings', api);
  const nextMonday = addDays(mondayOf(localDay(new Date(), TIME_ZONE)), 7);
  const monday = new Intl.DateTimeFormat('fr', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${nextMonday}T00:00:00Z`));
  await expect
    .element(page.getByText(`S'applique à partir du ${monday}.`, { exact: false }))
    .toBeVisible();
  const entries = page.getByRole('textbox', { name: 'Entrées dans le Funnel par semaine' });

  await entries.fill('8');
  expect(sentSettings(api)).toEqual([]);
  await userEvent.keyboard('{Enter}');

  await expect.element(page.getByText("Réglage enregistré : Objectif d'entrées")).toBeVisible();
  expect(sentSettings(api)).toEqual([{ entryGoal: 8 }]);

  await page.getByRole('textbox', { name: 'Rythme des Alliés, en jours' }).fill('21');
  await userEvent.keyboard('{Tab}');
  await expect.poll(() => sentSettings(api)).toEqual([{ entryGoal: 8 }, { checkInRhythmDays: 21 }]);

  // Turned off then on again, the Circle size goal comes back with its number.
  const circle = page.getByRole('checkbox', { name: 'Taille visée du Cercle' });
  await tick('Taille visée du Cercle');
  await expect.element(circle).not.toBeChecked();
  await expect.element(page.getByRole('textbox', { name: 'Alliés', exact: true })).toBeDisabled();
  await tick('Taille visée du Cercle');
  await expect
    .poll(() => sentSettings(api).slice(2))
    .toEqual([{ circleSizeGoal: null }, { circleSizeGoal: 10 }]);
});

test('the Default follow-up cadence saves with its button, without “Undo”', async () => {
  await desktop();
  const api = settingsApi();
  await renderApp('/settings', api);
  const cadence = page.getByRole('region', { name: 'Cadence par défaut' });
  const save = cadence.getByRole('button', { name: 'Enregistrer' });
  await expect.element(save).toBeDisabled();

  await cadence.getByRole('textbox', { name: 'Relance 1, en jours' }).fill('2');
  await userEvent.keyboard('{Tab}');
  expect(sentSettings(api)).toEqual([]);
  await cadence.getByRole('button', { name: 'Retirer la Relance 2' }).click();
  await cadence.getByRole('button', { name: 'Ajouter une Relance' }).click();
  await cadence.getByRole('textbox', { name: 'Délai de réponse, en jours' }).fill('10');
  await userEvent.keyboard('{Tab}');
  await save.click();

  await expect.element(page.getByText('Cadence par défaut enregistrée.')).toBeVisible();
  expect(sentSettings(api)).toEqual([
    { defaultCadence: { intervals: [2, 14, 14], responseWindowDays: 10 } },
  ]);
  await expect.element(page.getByRole('button', { name: /^Annuler$/ })).not.toBeInTheDocument();
  await expect.element(save).toBeDisabled();
});

test('changing the language changes the interface and `lang` at once; “Undo” brings it back', async () => {
  await desktop();
  const api = settingsApi();
  await renderApp('/settings', api);

  await page.getByRole('combobox', { name: 'Langue' }).selectOptions('en');

  await expect.element(page.getByRole('heading', { name: 'Preferences' })).toBeVisible();
  await expect.element(page.getByText('Setting saved: Language')).toBeVisible();
  expect(document.documentElement.lang).toBe('en');
  expect(sentSettings(api)).toEqual([{ locale: 'en' }]);

  await page.getByRole('button', { name: /^Undo$/ }).click();

  await expect.element(page.getByRole('heading', { name: 'Préférences' })).toBeVisible();
  expect(document.documentElement.lang).toBe('fr');
  expect(sentSettings(api)).toEqual([{ locale: 'en' }, { locale: 'fr' }]);
});

test('the language of the User follows it onto a device that shows another', async () => {
  await desktop();
  await renderApp('/settings', settingsApi({ locale: 'en' }));

  await expect.element(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  expect(document.documentElement.lang).toBe('en');
});

test('the time zone saves from tomorrow, and the theme stays on the device with its “Undo”', async () => {
  await desktop();
  const api = settingsApi();
  await renderApp('/settings', api);

  await page.getByRole('combobox', { name: 'Fuseau horaire' }).selectOptions('Asia/Tokyo');
  await expect.poll(() => sentSettings(api)).toEqual([{ timeZone: 'Asia/Tokyo' }]);

  await page.getByText('Sombre', { exact: true }).click();
  await expect.element(page.getByText('Réglage enregistré : Thème')).toBeVisible();
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(sentSettings(api)).toHaveLength(1);
  await expectNoAxeViolations();

  await page
    .getByRole('button', { name: /^Annuler$/ })
    .first()
    .click();
  await expect.poll(() => document.documentElement.classList.contains('dark')).toBe(false);
});

test('“Single-key shortcuts” off, `N` adds no Contact and its hint goes', async () => {
  await desktop();
  await renderApp('/settings', settingsApi({ singleKeyShortcuts: false }));
  const menu = page.getByRole('navigation', { name: 'Menu principal' });
  await expect.element(menu.getByRole('button', { name: 'Ajouter' })).toBeVisible();
  await expect.element(menu.getByText('N', { exact: true })).not.toBeInTheDocument();

  await userEvent.keyboard('n');

  await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
});

test('“Single-key shortcuts” on, `N` opens the quick add', async () => {
  await desktop();
  await renderApp('/settings', settingsApi());

  await userEvent.keyboard('n');

  await expect.element(page.getByRole('dialog')).toBeVisible();
});

test('on a phone, Settings keep the simple ones: language, theme, celebration, Account', async () => {
  await phone();
  await renderApp('/settings', settingsApi());

  await expect.element(page.getByRole('combobox', { name: 'Langue' })).toBeVisible();
  await expect.element(page.getByRole('radio', { name: 'Système' })).toBeChecked();
  await expect
    .element(page.getByRole('checkbox', { name: "Célébrer l'Objectif atteint" }))
    .toBeVisible();
  await expect.element(page.getByRole('heading', { name: 'Compte' })).toBeVisible();
  await expect
    .element(page.getByRole('checkbox', { name: "Objectif d'activité" }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole('combobox', { name: 'Fuseau horaire' }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole('navigation', { name: 'Sections des réglages' }))
    .not.toBeInTheDocument();
  await expectNoAxeViolations();
});
