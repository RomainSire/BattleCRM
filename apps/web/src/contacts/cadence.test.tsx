import { addDays, localDay } from '@battlecrm/domain';
import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import { contact, positioning, stage, summary } from '../../test/summary.ts';
import type { SummaryContact } from '../summary.ts';

const desktop = () => page.viewport(1280, 800);

const TIME_ZONE = 'Europe/Paris';
/** Today for the User, as the SPA reads it. */
const today = () => localDay(new Date(), TIME_ZONE);
/** A local day as the User reads it. */
const shown = (day: string) =>
  new Intl.DateTimeFormat('fr', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );

const OUTREACH = stage({ id: '01990000-0000-7000-8000-000000000011', name: 'Approche' });
/** Sent by LinkedIn, with a CV; Follow-up 2 has a message, Follow-up 3 none. */
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
  responseWindowDays: 14,
  attachments: [
    {
      id: '01990000-0000-7000-8000-000000000041',
      name: 'cv.pdf',
      contentType: 'application/pdf',
      size: 1200,
    },
  ],
  used: true,
});

/** Sent “CV B” ten days ago, followed up seven days ago: Follow-up `rank` is due today. */
const claire = (rank: number): SummaryContact =>
  contact({
    id: '01990000-0000-7000-8000-000000000001',
    name: 'Claire Martin',
    status: 'prospecting',
    stageId: OUTREACH.id,
    lastInteractionAt: '2026-01-08T09:00:00.000Z',
    lastInteractionOn: addDays(today(), -7),
    followUp: { dueOn: today(), note: null, rank },
    lastPositioningUse: { positioningId: CV_B.id, sentOn: addDays(today(), -10) },
  });

const threadOf = () => ({
  note: null,
  thread: [
    {
      id: '01990000-0000-7000-8000-000000000032',
      kind: 'follow_up',
      direction: 'outbound',
      occurredAt: '2026-01-08T09:00:00.000Z',
      localDate: addDays(today(), -7),
      note: null,
      channel: null,
      positioningId: null,
      statusChange: null,
    },
    {
      id: '01990000-0000-7000-8000-000000000031',
      kind: 'positioning_used',
      direction: 'outbound',
      occurredAt: '2026-01-05T09:00:00.000Z',
      localDate: addDays(today(), -10),
      note: null,
      channel: null,
      positioningId: CV_B.id,
      statusChange: null,
    },
  ],
});

function cadenceApi(followed: SummaryContact) {
  return fakeApi({
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: TIME_ZONE,
          contacts: [followed],
          stages: [OUTREACH],
          positionings: [CV_B],
        }),
      ),
    [`GET /api/contacts/${followed.id}/record`]: () => Response.json(threadOf()),
  });
}

beforeEach(() => {
  sessionStorage.clear();
});

test('“Follow up…” on a rank of the Cadence shows what was sent and when, its Channel, the message of the rank and the attachments, then the next Follow-up', async () => {
  await desktop();
  const followed = claire(2);
  await renderApp(`/contacts/${followed.id}?followUp=do`, cadenceApi(followed));

  const dialog = page.getByRole('dialog', { name: 'Relancer Claire Martin' });
  await expect
    .element(dialog)
    .toHaveTextContent(`« CV B » envoyé le ${shown(addDays(today(), -10))}`);
  await expect.element(dialog).toHaveTextContent('par LinkedIn');
  await expect
    .element(dialog)
    .toHaveTextContent('Bonjour Claire, je me permets de revenir vers vous.');
  await expect.element(dialog.getByRole('button', { name: 'Copier le message' })).toBeVisible();
  await expect.element(dialog.getByRole('link', { name: 'cv.pdf' })).toBeVisible();
  // The next interval, 14 days, counts from the day it is done.
  await expect
    .element(dialog)
    .toHaveTextContent(`Puis la Relance 3 le ${shown(addDays(today(), 14))}`);
  await dialog.getByText('Hier').click();
  await expect
    .element(dialog)
    .toHaveTextContent(`Puis la Relance 3 le ${shown(addDays(today(), 13))}`);
});

test('“Follow up…” on the last rank, without a message, announces the Response window', async () => {
  await desktop();
  const followed = claire(3);
  await renderApp(`/contacts/${followed.id}?followUp=do`, cadenceApi(followed));

  const dialog = page.getByRole('dialog', { name: 'Relancer Claire Martin' });
  await expect
    .element(dialog)
    .toHaveTextContent('Pas de message pour la Relance 3 : écris le tien.');
  await expect.element(dialog).toHaveTextContent('Puis le Délai de réponse (14 j)');
});

test('“Note an Interaction” says how it moves the Follow-up of the Cadence', async () => {
  await desktop();
  const followed = claire(2);
  await renderApp(`/contacts/${followed.id}?interaction=note`, cadenceApi(followed));

  const dialog = page.getByRole('dialog', { name: 'Noter une Interaction avec Claire Martin' });
  // Its 7 days count from the call, today.
  await expect
    .element(dialog)
    .toHaveTextContent(`La Relance 2 passe au ${shown(addDays(today(), 7))}`);
});

test('“Replied…” says the Cadence stops when its Follow-up is kept', async () => {
  await desktop();
  const followed = claire(2);
  await renderApp(`/contacts/${followed.id}?interaction=reply`, cadenceApi(followed));

  const dialog = page.getByRole('dialog', { name: 'Claire Martin a répondu' });
  await dialog.getByText(`Annuler la Relance 2 du ${shown(today())}`).click();
  await expect
    .element(dialog)
    .toHaveTextContent(
      `La Cadence s'arrête : la Relance du ${shown(today())} reste planifiée, hors Cadence`,
    );
});
