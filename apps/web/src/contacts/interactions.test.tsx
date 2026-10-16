import { addDays, localDay } from '@battlecrm/domain';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import { changes, contact, stage, summary } from '../../test/summary.ts';
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

/** A Contact Prospecting at Approche, unless told otherwise. */
const prospect = (fields: Partial<SummaryContact>) =>
  contact({
    status: 'prospecting',
    stageId: OUTREACH.id,
    lastInteractionAt: '2026-01-08T09:00:00.000Z',
    lastInteractionOn: '2026-01-08',
    ...fields,
  });

/** Prospecting, nothing scheduled. */
const MARC = prospect({ id: '01990000-0000-7000-8000-000000000002', name: 'Marc Petit' });
/** Prospecting, a Follow-up to come. */
const julie = () =>
  prospect({
    id: '01990000-0000-7000-8000-000000000001',
    name: 'Julie Martin',
    followUp: { dueOn: addDays(today(), 4), note: 'Relancer sur le devis', rank: null },
  });
/** An Ally, nothing scheduled. */
const INES = prospect({
  id: '01990000-0000-7000-8000-000000000003',
  name: 'Inès Moreau',
  status: 'ally',
});
/** In the Pool, where it left the Funnel at Outreach. */
const LEA = prospect({
  id: '01990000-0000-7000-8000-000000000004',
  name: 'Léa Bernard',
  status: 'pool',
});

const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';
const UNDO_ROUTE = `POST /api/gestures/${UNDO_TOKEN}/undo`;
const noteRoute = (id: string) => `POST /api/contacts/${id}/note-interaction`;
const replyRoute = (id: string) => `POST /api/contacts/${id}/record-reply`;

/** An API that notes Interactions and records replies as the server would, and takes them back. */
function interactionApi(overrides: Parameters<typeof fakeApi>[0] = {}) {
  const contacts = [MARC, julie(), INES, LEA];
  let undone: SummaryContact = MARC;
  const routes: Parameters<typeof fakeApi>[0] = {
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: TIME_ZONE,
          settings: { activityGoal: { inEffect: 3, chosen: 3 } },
          contacts,
          stages: [OUTREACH],
        }),
      ),
    [UNDO_ROUTE]: () => Response.json({ changes: changes({ contacts: [undone] }) }),
  };
  for (const before of contacts) {
    routes[`GET /api/contacts/${before.id}/record`] = () =>
      Response.json({ note: null, thread: [] });
    routes[noteRoute(before.id)] = (body) => {
      const { occurredOn } = z
        .strictObject({ kind: z.string(), occurredOn: z.iso.date(), note: z.string().optional() })
        .parse(body);
      undone = before;
      return Response.json({
        changes: changes({ contacts: [{ ...before, lastDoneInteractionOn: occurredOn }] }),
        undoToken: UNDO_TOKEN,
      });
    };
    routes[replyRoute(before.id)] = (body) => {
      const { occurredOn, cancelFollowUp, status, stageId } = z
        .strictObject({
          occurredOn: z.iso.date(),
          channel: z.enum(['email', 'linkedin', 'phone', 'mail']),
          note: z.string().optional(),
          cancelFollowUp: z.literal(true).optional(),
          status: z.enum(['prospecting', 'ally']).optional(),
          stageId: z.uuid().optional(),
        })
        .parse(body);
      undone = before;
      return Response.json({
        changes: changes({
          contacts: [
            {
              ...before,
              lastDoneInteractionOn: occurredOn,
              ...(cancelFollowUp && { followUp: null }),
              ...(status && { status, stageId: stageId ?? before.stageId }),
            },
          ],
        }),
        undoToken: UNDO_TOKEN,
      });
    };
  }
  return fakeApi({ ...routes, ...overrides });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(async () => {
  await commands.emulateColorScheme('light');
});

test('I notes an Interaction: its kind, its day and a note, off the Activity; then “Undo”', async () => {
  await desktop();
  const api = interactionApi();
  await renderApp(`/contacts/${MARC.id}`, api);
  await expect.element(page.getByRole('button', { name: 'Noter une Interaction' })).toBeVisible();

  await userEvent.keyboard('i');

  const dialog = page.getByRole('dialog', { name: 'Noter une Interaction avec Marc Petit' });
  await expect.element(dialog).toHaveTextContent("Hors Activité : ne compte pas dans l'Activité");
  const note = dialog.getByRole('textbox', { name: 'Note (facultative)' });
  await expect.element(note).toHaveFocus();
  await dialog.getByText('Rencontre').click();
  await dialog.getByText('Hier').click();
  await note.fill(' Croisé au salon ');
  await userEvent.keyboard('{Enter}');

  await expect.element(page.getByText('Interaction notée avec Marc Petit')).toBeVisible();
  expect(api.sent(noteRoute(MARC.id)).map(({ body }) => body)).toEqual([
    { kind: 'meeting', occurredOn: addDays(today(), -1), note: 'Croisé au salon' },
  ]);
  await expect.element(dialog).not.toBeInTheDocument();

  await page.getByRole('button', { name: /^Annuler$/ }).click();
  await expect.element(page.getByText('Annulé.')).toBeVisible();
  expect(api.sent(UNDO_ROUTE)).toHaveLength(1);
});

test('whatever came in goes through “Replied…”, which the panel links to', async () => {
  await desktop();
  const { router } = await renderApp(`/contacts/${MARC.id}`, interactionApi());
  await page.getByRole('button', { name: 'Noter une Interaction' }).click();
  const note = page.getByRole('dialog', { name: 'Noter une Interaction avec Marc Petit' });

  await note.getByRole('button', { name: 'A répondu…' }).click();

  await expect.element(page.getByRole('dialog', { name: 'Marc Petit a répondu' })).toBeVisible();
  await expect.element(note).not.toBeInTheDocument();
  expect(router.state.location.search).toEqual({ interaction: 'reply' });
});

test('“Replied…” takes a day, a Channel and a note, never a nature, and cancels the scheduled Follow-up by default', async () => {
  await desktop();
  const api = interactionApi();
  await renderApp(`/contacts/${julie().id}`, api);
  const next = page.getByRole('region', { name: 'Prochaine action' });
  await next.getByRole('button', { name: "Plus d'actions" }).click();
  await page.getByRole('menuitem', { name: 'A répondu…' }).click();

  const dialog = page.getByRole('dialog', { name: 'Julie Martin a répondu' });
  const date = shown(addDays(today(), 4));
  await expect
    .element(dialog.getByRole('checkbox', { name: `Annuler la Relance du ${date}` }))
    .toBeChecked();
  await expect.element(dialog).toHaveTextContent(`La Relance du ${date} est annulée`);
  await dialog.getByText('LinkedIn').click();
  await dialog.getByRole('textbox', { name: 'Note (facultative)' }).fill('Demande mon CV');
  await dialog.getByRole('button', { name: 'Enregistrer la réponse' }).click();

  await expect.element(page.getByText('Réponse de Julie Martin enregistrée')).toBeVisible();
  expect(api.sent(replyRoute(julie().id)).map(({ body }) => body)).toEqual([
    { occurredOn: today(), channel: 'linkedin', note: 'Demande mon CV', cancelFollowUp: true },
  ]);
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(next).toHaveTextContent('Sans prochaine action');

  await page.getByRole('button', { name: /^Annuler$/ }).click();
  await expect.element(page.getByText('Annulé.')).toBeVisible();
});

test('a reply that keeps the Follow-up sends no cancellation', async () => {
  await desktop();
  const api = interactionApi();
  await renderApp(`/contacts/${julie().id}?interaction=reply`, api);
  const dialog = page.getByRole('dialog', { name: 'Julie Martin a répondu' });

  await dialog.getByText(/^Annuler la Relance du/).click();
  await expect.element(dialog).not.toHaveTextContent('est annulée');
  await userEvent.keyboard('{Enter}');

  await expect.poll(() => api.sent(replyRoute(julie().id))).toHaveLength(1);
  expect(api.sent(replyRoute(julie().id))[0]?.body).toEqual({
    occurredOn: today(),
    channel: 'email',
  });
});

test('a spontaneous reply from the Pool leaves it there by default, or brings it in at its last Stage', async () => {
  await desktop();
  const api = interactionApi();
  await renderApp(`/contacts/${LEA.id}?interaction=reply`, api);
  const dialog = page.getByRole('dialog', { name: 'Léa Bernard a répondu' });
  await expect.element(dialog.getByRole('radio', { name: 'Laisser au Vivier' })).toBeChecked();
  await expect.element(dialog.getByRole('checkbox')).not.toBeInTheDocument();

  // Added to the Circle on a reply of yesterday: its next check-in comes a Rhythm after it.
  await dialog.getByText('Ajouter au Cercle').click();
  await dialog.getByText('Hier').click();
  await expect
    .element(dialog)
    .toHaveTextContent(`prochaines nouvelles d'ici le ${shown(addDays(today(), 27))}`);
  await dialog.getByText("Aujourd'hui").click();
  await dialog.getByText('Faire entrer').click();

  await expect.element(dialog.getByRole('combobox', { name: 'Étape' })).toHaveValue(OUTREACH.id);
  await expect.element(dialog).toHaveTextContent('Entrée n°1 cette semaine (1/5)');
  await dialog.getByRole('button', { name: 'Enregistrer la réponse' }).click();

  await expect
    .element(page.getByText('Léa Bernard entre dans le Funnel à Approche · Entrées 1/5'))
    .toBeVisible();
  expect(api.sent(replyRoute(LEA.id))[0]?.body).toEqual({
    occurredOn: today(),
    channel: 'email',
    status: 'prospecting',
    stageId: OUTREACH.id,
  });
});

test('an Ally: no Note an Interaction (a Check-in instead), no choice of Status; its reply may chain to a Follow-up', async () => {
  await desktop();
  const api = interactionApi();
  const { router } = await renderApp(`/contacts/${INES.id}`, api);
  await expect.element(page.getByRole('heading', { level: 1, name: /Inès Moreau/ })).toBeVisible();
  await expect
    .element(page.getByRole('button', { name: 'Noter une Interaction' }))
    .not.toBeInTheDocument();
  await userEvent.keyboard('i');
  expect(router.state.location.search).toEqual({});

  await page.getByRole('button', { name: "Plus d'actions" }).click();
  await page.getByRole('menuitem', { name: 'A répondu…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Inès Moreau a répondu' });
  await expect
    .element(dialog.getByRole('radio', { name: 'Laisser au Vivier' }))
    .not.toBeInTheDocument();
  await expect
    .element(dialog)
    .toHaveTextContent(`Jours sans contact comptés depuis le ${shown(today())}`);
  await dialog.getByText('Planifier une Relance…').click();
  await dialog.getByRole('button', { name: 'Enregistrer la réponse' }).click();

  await expect
    .element(page.getByRole('dialog', { name: 'Planifier une Relance pour Inès Moreau' }))
    .toBeVisible();
  expect(router.state.location.search).toEqual({ followUp: 'schedule' });
  expect(api.sent(replyRoute(INES.id))).toHaveLength(1);
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing in the panels of Note an Interaction and Replied…, in the %s theme',
  async (scheme) => {
    await commands.emulateColorScheme(scheme);
    await desktop();
    await renderApp(`/contacts/${LEA.id}?interaction=note`, interactionApi());
    await expect.element(page.getByRole('dialog')).toBeVisible();
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');
    await expectNoAxeViolations();

    await page.getByRole('dialog').getByRole('button', { name: 'A répondu…' }).click();
    await page.getByRole('dialog').getByText('Faire entrer', { exact: true }).click();
    await expect.element(page.getByRole('combobox', { name: 'Étape' })).toBeVisible();

    await expectNoAxeViolations();
  },
);
