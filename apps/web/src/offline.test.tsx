import { addDays, localDay } from '@battlecrm/domain';
import { onlineManager } from '@tanstack/react-query';
import { get } from 'idb-keyval';
import { afterEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { fakeApi } from '../test/fake-api.ts';
import { renderApp } from '../test/render-app.tsx';
import { contact, positioning, stage, summary } from '../test/summary.ts';
import { DEVICE_DATA_KEY } from './device-data.ts';
import type { Summary } from './summary.ts';

// Offline, the app reads what the device kept and saves nothing (ADR 0004, ST-03).

const TIME_ZONE = 'Europe/Paris';
const today = () => localDay(new Date(), TIME_ZONE);

const OUTREACH = stage({ id: '01990000-0000-7000-8000-000000000011', name: 'Approche' });
const CV_B = positioning({
  id: '01990000-0000-7000-8000-000000000021',
  stageId: OUTREACH.id,
  label: 'CV B',
  channel: 'linkedin',
  followUps: [
    { days: 3, message: 'Petit up.' },
    { days: 7, message: 'Bonjour {prénom}, je me permets de revenir vers vous.' },
    { days: 14, message: null },
  ],
  used: true,
});

/** Sent “CV B” ten days ago: Follow-up 2 is due today. */
const claire = contact({
  id: '01990000-0000-7000-8000-000000000001',
  name: 'Claire Martin',
  status: 'prospecting',
  stageId: OUTREACH.id,
  followUp: { dueOn: today(), note: null, rank: 2 },
  lastPositioningUse: { positioningId: CV_B.id, sentOn: addDays(today(), -10) },
});

const kept = () =>
  summary({ timeZone: TIME_ZONE, contacts: [claire], stages: [OUTREACH], positionings: [CV_B] });

afterEach(() => {
  onlineManager.setOnline(true);
});

/** The app used online once: the summary it read stays on the device, as the app itself kept it. */
async function usedOnline(read: Summary) {
  const online = await renderApp(
    '/today',
    fakeApi({ 'GET /api/summary': () => Response.json(read) }),
  );
  await expect
    .poll(async () => {
      const persisted: { clientState: { queries: unknown[] } } | undefined =
        await get(DEVICE_DATA_KEY);
      return persisted?.clientState.queries.length;
    })
    .toBe(1);
  await online.screen.unmount();
}

/** The app opened again without a network: every request fails, as a browser's does. */
async function openOffline(path: string) {
  onlineManager.setOnline(false);
  const attempts: string[] = [];
  const api = fakeApi();
  return {
    attempts,
    ...(await renderApp(path, {
      ...api,
      fetch: async (input, init) => {
        const request = new Request(input, init);
        attempts.push(`${request.method} ${new URL(request.url).pathname}`);
        throw new TypeError('Failed to fetch');
      },
    })),
  };
}

test('“Follow up…” still shows the message of the Cadence and copies it, from the summary kept', async () => {
  await usedOnline(kept());
  const copied = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

  await openOffline(`/contacts/${claire.id}?followUp=do`);

  const dialog = page.getByRole('dialog', { name: 'Relancer Claire Martin' });
  await expect
    .element(dialog)
    .toHaveTextContent('Bonjour Claire, je me permets de revenir vers vous.');
  await dialog.getByRole('button', { name: 'Copier le message' }).click();
  expect(copied).toHaveBeenCalledWith('Bonjour Claire, je me permets de revenir vers vous.');
});

test('a gesture cannot be sent offline, and its panel says why; nothing leaves the device', async () => {
  await usedOnline(kept());

  const { attempts } = await openOffline(`/contacts/${claire.id}?followUp=do`);

  const dialog = page.getByRole('dialog', { name: 'Relancer Claire Martin' });
  await expect.element(dialog.getByRole('button', { name: 'Relancer' })).toBeDisabled();
  await expect
    .element(dialog)
    .toHaveTextContent(
      'Hors ligne : consultation seulement. Les actions reviennent avec la connexion.',
    );
  await dialog.getByRole('textbox', { name: 'Note (facultative)' }).click();
  await userEvent.keyboard('{Enter}');
  expect(attempts.filter((attempt) => !attempt.startsWith('GET'))).toEqual([]);
});

test('Today reads the summary kept, and the app says it is offline', async () => {
  await usedOnline(kept());

  const { screen } = await openOffline('/today');

  await expect.element(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Aujourd'hui");
  await expect.element(screen.getByText('Claire Martin').first()).toBeVisible();
  await expect
    .element(screen.getByRole('status').filter({ hasText: 'Hors ligne' }))
    .toHaveTextContent(
      'Hors ligne : consultation seulement. Les actions reviennent avec la connexion.',
    );
});

test('the record of a Contact reads offline; what it does at once is disabled, and its thread waits for the connection', async () => {
  await usedOnline(kept());

  const { screen } = await openOffline(`/contacts/${claire.id}`);

  await expect
    .element(screen.getByRole('heading', { level: 1 }))
    .toHaveTextContent('Claire Martin');
  await expect.element(screen.getByRole('button', { name: 'Reporter la Relance' })).toBeDisabled();
  await expect.element(screen.getByRole('button', { name: 'Annuler la Relance' })).toBeDisabled();
  // Opening a gesture stays possible: its panel reads, and copies, offline.
  await expect.element(screen.getByRole('button', { name: 'Relancer…' }).first()).toBeEnabled();
  await expect.element(screen.getByText('Le fil se charge avec la connexion.')).toBeVisible();
});

test('back online, the actions come back and the note goes', async () => {
  await usedOnline(kept());
  const { screen } = await openOffline(`/contacts/${claire.id}`);
  await expect.element(screen.getByRole('button', { name: 'Annuler la Relance' })).toBeDisabled();

  onlineManager.setOnline(true);

  await expect.element(screen.getByRole('button', { name: 'Annuler la Relance' })).toBeEnabled();
  expect(
    screen.getByText('Hors ligne : consultation seulement.', { exact: false }).elements(),
  ).toEqual([]);
});
