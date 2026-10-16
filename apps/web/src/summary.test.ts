import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { fakeApi } from '../test/fake-api.ts';
import { renderApp } from '../test/render-app.tsx';
import { DEVICE_TIME_ZONE, positioning, stage, summary } from '../test/summary.ts';
import { timeZoneOf, type Summary } from './summary.ts';

const desktop = () => page.viewport(1280, 900);

const OUTREACH = stage({ id: '01990000-0000-7000-8000-000000000011', name: 'Approche' });

/** An API that answers a summary kept by a previous version: what a device may still hold. */
const keptFromBefore = (old: object) => fakeApi({ 'GET /api/summary': () => Response.json(old) });

/** A summary from before Positionings, Settings and the time zone. */
function beforePositionings() {
  const {
    positionings: _positionings,
    settings: _settings,
    timeZone: _timeZone,
    ...old
  } = summary({ stages: [OUTREACH] });
  return old;
}

test('a summary from before Positionings shows none in the workshop', async () => {
  await desktop();
  await renderApp('/positionings', keptFromBefore(beforePositionings()));

  await expect
    .element(page.getByRole('region', { name: 'Positionnements de Approche' }))
    .toHaveTextContent('Aucun Positionnement pour cette Étape.');
});

test('a summary from before Settings shows the Settings of a new User, in the time zone of this device', async () => {
  await desktop();
  await renderApp('/settings', keptFromBefore(beforePositionings()));

  const prospecting = page.getByRole('region', { name: 'Prospection' });
  await expect
    .element(prospecting.getByRole('textbox', { name: 'Entrées dans le Funnel par semaine' }))
    .toHaveValue('5');
  await expect
    .element(prospecting.getByRole('textbox', { name: 'Rythme des Alliés, en jours' }))
    .toHaveValue('28');
  await expect
    .element(
      page
        .getByRole('region', { name: 'Préférences' })
        .getByRole('combobox', { name: 'Fuseau horaire' }),
    )
    .toHaveValue(DEVICE_TIME_ZONE);
});

test('a Positioning from before attachments shows none', async () => {
  await desktop();
  const { attachments: _attachments, ...mail } = positioning({
    label: 'Mail long',
    stageId: OUTREACH.id,
  });
  const old = { ...summary({ stages: [OUTREACH] }), positionings: [mail] };
  await renderApp('/positionings', keptFromBefore(old));
  await page.getByRole('link', { name: /Mail long/ }).click();

  const record = page.getByRole('region', { name: 'Mail long' });
  await expect.element(record).toHaveTextContent('Tous types, 5 Mo par fichier, 100 Mo en tout.');
  expect(record.getByRole('link').elements()).toEqual([]);
});

test('without a time zone in the summary, or while it is read, today is read in the time zone of this device', () => {
  // What a device reads from its store: JSON, whatever the version that wrote it.
  const old: Summary = JSON.parse(JSON.stringify(beforePositionings()));

  expect(timeZoneOf(old)).toBe(DEVICE_TIME_ZONE);
  expect(timeZoneOf(undefined)).toBe(DEVICE_TIME_ZONE);
  expect(timeZoneOf(summary({ timeZone: 'Asia/Tokyo' }))).toBe('Asia/Tokyo');
});
