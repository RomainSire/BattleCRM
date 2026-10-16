import { addDays, localDay } from '@battlecrm/domain';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import { changes, contact, positioning, stage, summary } from '../../test/summary.ts';
import type { SummaryContact, SummaryPositioning } from '../summary.ts';

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
const SCREENING = stage({ id: '01990000-0000-7000-8000-000000000012', name: 'Qualification' });

/** At Approche: a short e-mail with the first name and a CV, then a call script. */
const CV = positioning({
  id: '01990000-0000-7000-8000-000000000021',
  stageId: OUTREACH.id,
  label: 'CV Rust',
  content: 'Bonjour {prénom}, freelance Rust dispo en novembre.',
  attachments: [
    {
      id: '01990000-0000-7000-8000-000000000031',
      name: 'cv-rust.pdf',
      contentType: 'application/pdf',
      size: 2048,
    },
  ],
});
const CALL = positioning({
  id: '01990000-0000-7000-8000-000000000022',
  stageId: OUTREACH.id,
  label: 'Appel',
  channel: 'phone',
  followUps: [{ days: 7, message: null }],
});
/** Archived: never offered. */
const OLD = positioning({
  id: '01990000-0000-7000-8000-000000000023',
  stageId: OUTREACH.id,
  label: 'Ancien mail',
  archived: true,
});

/** A Contact Prospecting at Approche, unless told otherwise. */
const prospect = (fields: Partial<SummaryContact>) =>
  contact({
    status: 'prospecting',
    stageId: OUTREACH.id,
    lastInteractionAt: '2026-01-08T09:00:00.000Z',
    lastInteractionOn: '2026-01-08',
    ...fields,
  });

/** Prospecting, nothing scheduled: the action of the moment is to use a Positioning. */
const MARC = prospect({ id: '01990000-0000-7000-8000-000000000002', name: 'Marc Petit' });
/** Prospecting at a Stage that has no Positioning yet. */
const PAUL = prospect({
  id: '01990000-0000-7000-8000-000000000005',
  name: 'Paul Durand',
  stageId: SCREENING.id,
});
const INES = prospect({
  id: '01990000-0000-7000-8000-000000000003',
  name: 'Inès Moreau',
  status: 'ally',
});
/** In the Pool, where it left the Funnel at Approche. */
const LEA = prospect({
  id: '01990000-0000-7000-8000-000000000004',
  name: 'Léa Bernard',
  status: 'pool',
});

const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';
const UNDO_ROUTE = `POST /api/gestures/${UNDO_TOKEN}/undo`;
const useRoute = (id: string) => `POST /api/contacts/${id}/use-positioning`;

const useBody = z.strictObject({
  positioningId: z.uuid(),
  occurredOn: z.iso.date(),
  followUpOn: z.iso.date().optional(),
  bringIn: z.literal(true).optional(),
});

/** An API that records uses as the server would, and takes them back. */
function sendApi(overrides: Parameters<typeof fakeApi>[0] = {}) {
  const contacts = [MARC, PAUL, INES, LEA];
  const positionings: SummaryPositioning[] = [CV, CALL, OLD];
  let undone: SummaryContact = MARC;
  const routes: Parameters<typeof fakeApi>[0] = {
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: TIME_ZONE,
          settings: { activityGoal: { inEffect: 3, chosen: 3 } },
          contacts,
          stages: [OUTREACH, SCREENING],
          positionings,
        }),
      ),
    [UNDO_ROUTE]: () => Response.json({ changes: changes({ contacts: [undone] }) }),
    'POST /api/positionings': (body) => {
      const { label, stageId } = z.object({ label: z.string(), stageId: z.uuid() }).parse(body);
      const created = positioning({ id: '01990000-0000-7000-8000-000000000024', stageId, label });
      positionings.push(created);
      return Response.json(
        { changes: changes({ positionings: [created] }), undoToken: UNDO_TOKEN },
        { status: 201 },
      );
    },
  };
  for (const before of contacts) {
    routes[`GET /api/contacts/${before.id}/record`] = () =>
      Response.json({ note: null, thread: [] });
    routes[useRoute(before.id)] = (body) => {
      const { positioningId, occurredOn, followUpOn, bringIn } = useBody.parse(body);
      const used = positionings.find(({ id }) => id === positioningId);
      const days = used?.followUps[0]?.days;
      const isProspecting = bringIn === true || before.status === 'prospecting';
      undone = before;
      return Response.json({
        changes: changes({
          contacts: [
            {
              ...before,
              status: isProspecting ? 'prospecting' : before.status,
              lastDoneInteractionOn: occurredOn,
              prospectingActionDays: [...before.prospectingActionDays, occurredOn],
              followUp:
                isProspecting && days !== undefined
                  ? { dueOn: followUpOn ?? addDays(occurredOn, days), note: null, rank: 1 }
                  : before.followUp,
            },
          ],
          positionings: used ? [{ ...used, used: true }] : [],
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
  vi.restoreAllMocks();
  await commands.emulateColorScheme('light');
});

test('without a Follow-up nor a Trial, U sends a Positioning of the Stage: its text to copy, its files, Follow-up 1; then “Undo”', async () => {
  await desktop();
  const copied = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  const api = sendApi();
  await renderApp(`/contacts/${MARC.id}`, api);
  const next = page.getByRole('region', { name: 'Prochaine action' });
  await expect
    .element(next.getByRole('button', { name: 'Utiliser un Positionnement' }))
    .toBeVisible();

  await userEvent.keyboard('u');

  const dialog = page.getByRole('dialog', { name: 'Envoyer à Marc Petit' });
  await expect.element(dialog).toHaveTextContent('Étape Approche · pas de Battle ouverte');
  // Never an archived one; the first of the Stage unless another is chosen.
  await expect.element(dialog.getByRole('radio', { name: 'CV Rust' })).toBeChecked();
  await expect.element(dialog.getByRole('radio', { name: 'Ancien mail' })).not.toBeInTheDocument();
  await expect.element(dialog).toHaveTextContent('par E-mail');
  await expect.element(dialog).toHaveTextContent('Bonjour Marc, freelance Rust dispo en novembre.');
  await expect
    .element(dialog.getByRole('link', { name: /cv-rust\.pdf/ }))
    .toHaveAttribute(
      'href',
      `${location.origin}/api/attachments/01990000-0000-7000-8000-000000000031`,
    );
  await dialog.getByRole('button', { name: 'Copier le message' }).click();
  expect(copied).toHaveBeenCalledWith('Bonjour Marc, freelance Rust dispo en novembre.');
  await expect.element(dialog).toHaveTextContent('Interaction enregistrée, sans Essai');
  await expect.element(dialog).toHaveTextContent(`Relance 1 le ${shown(addDays(today(), 3))}`);
  await expect.element(dialog).toHaveTextContent("+1 à l'Activité d'aujourd'hui (1/3)");
  // `Enter` on a button presses it: from the day sent, it validates.
  await dialog.getByText("Aujourd'hui", { exact: true }).click();
  await userEvent.keyboard('{Enter}');

  await expect
    .element(
      page.getByText(
        `Envoyé à Marc Petit : « CV Rust », sans Essai. Relance 1 le ${shown(addDays(today(), 3))}.`,
      ),
    )
    .toBeVisible();
  expect(api.sent(useRoute(MARC.id)).map(({ body }) => body)).toEqual([
    { positioningId: CV.id, occurredOn: today() },
  ]);
  await expect.element(dialog).not.toBeInTheDocument();
  const head = page.getByRole('region', { name: 'Relance 1' });
  await expect.element(head).toBeVisible();

  await page.getByRole('button', { name: /^Annuler$/ }).click();

  await expect.element(page.getByText('Annulé.')).toBeVisible();
  expect(api.sent(UNDO_ROUTE)).toHaveLength(1);
  await expect.element(head).not.toBeInTheDocument();
});

test('sent long ago, Follow-up 1 is already overdue: “edit” gives it another day; “Later” sends nothing', async () => {
  await desktop();
  const api = sendApi();
  await renderApp(`/contacts/${MARC.id}?send=positioning`, api);
  const dialog = page.getByRole('dialog', { name: 'Envoyer à Marc Petit' });

  await dialog.getByText('Appel', { exact: true }).click();
  await expect.element(dialog).toHaveTextContent('par Téléphone');
  await expect.element(dialog).toHaveTextContent('Rien à copier ni à joindre.');
  await dialog.getByText('Une date').click();
  await dialog.getByLabelText('Jour', { exact: true }).fill(addDays(today(), -10));
  await expect
    .element(dialog)
    .toHaveTextContent(`Relance 1 le ${shown(addDays(today(), -3))} · déjà en retard`);
  await expect
    .element(dialog)
    .toHaveTextContent(`+1 à l'Activité du ${shown(addDays(today(), -10))}`);
  await dialog.getByRole('button', { name: 'Modifier la date de la Relance 1' }).click();
  const day = dialog.getByLabelText('Date de la Relance 1');
  await expect.element(day).toHaveValue(addDays(today(), -3));
  await day.fill(addDays(today(), 2));
  await expect.element(dialog).toHaveTextContent(`Relance 1 le ${shown(addDays(today(), 2))}`);
  await expect.element(dialog).not.toHaveTextContent('déjà en retard');

  await dialog.getByRole('button', { name: 'Plus tard' }).click();
  await expect.element(dialog).not.toBeInTheDocument();
  expect(api.sent(useRoute(MARC.id))).toEqual([]);

  await userEvent.keyboard('u');
  await page.getByRole('dialog').getByText('Appel', { exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Modifier la date de la Relance 1' })
    .click();
  await page.getByRole('dialog').getByLabelText('Date de la Relance 1').fill(addDays(today(), 9));
  await page.getByRole('dialog').getByRole('button', { name: "C'est envoyé" }).click();
  await expect.poll(() => api.sent(useRoute(MARC.id))).toHaveLength(1);
  expect(api.sent(useRoute(MARC.id))[0]?.body).toEqual({
    positioningId: CALL.id,
    occurredOn: today(),
    followUpOn: addDays(today(), 9),
  });
});

test('from the Pool, “Bring in and continue” by default; “Record without a Trial” leaves it in the Pool, without a Follow-up', async () => {
  await desktop();
  const api = sendApi();
  await renderApp(`/contacts/${LEA.id}`, api);
  await page
    .getByRole('region', { name: 'Prochaine action' })
    .getByRole('button', { name: "Plus d'actions" })
    .click();
  await page.getByRole('menuitem', { name: 'Utiliser un Positionnement' }).click();

  const dialog = page.getByRole('dialog', { name: 'Envoyer à Léa Bernard' });
  await expect.element(dialog).toHaveTextContent('Léa Bernard est au Vivier.');
  await expect
    .element(dialog.getByRole('radio', { name: 'Faire entrer et continuer' }))
    .toBeChecked();
  await expect.element(dialog).toHaveTextContent('Entrée n°1 cette semaine');
  await expect.element(dialog).toHaveTextContent(`Relance 1 le ${shown(addDays(today(), 3))}`);
  await dialog.getByText('Enregistrer sans Essai').click();
  await expect.element(dialog).not.toHaveTextContent('Relance 1');
  await expect.element(dialog).not.toHaveTextContent('Entrée n°1');
  await dialog.getByText('Faire entrer et continuer').click();
  await dialog.getByRole('button', { name: "C'est envoyé" }).click();

  await expect.poll(() => api.sent(useRoute(LEA.id))).toHaveLength(1);
  expect(api.sent(useRoute(LEA.id))[0]?.body).toEqual({
    positioningId: CV.id,
    occurredOn: today(),
    bringIn: true,
  });
});

test('an Ally is sent one without a Trial nor a Cadence: its Days since contact start again', async () => {
  await desktop();
  const api = sendApi();
  await renderApp(`/contacts/${INES.id}?send=positioning`, api);
  const dialog = page.getByRole('dialog', { name: 'Envoyer à Inès Moreau' });

  await expect.element(dialog).toHaveTextContent('Jours sans contact remis à 0');
  await expect.element(dialog).not.toHaveTextContent('Relance 1');
  await dialog.getByRole('button', { name: "C'est envoyé" }).click();

  await expect
    .element(page.getByText('Envoyé à Inès Moreau : « CV Rust », sans Essai.'))
    .toBeVisible();
  expect(api.sent(useRoute(INES.id))[0]?.body).toEqual({
    positioningId: CV.id,
    occurredOn: today(),
  });
});

test('a Stage without a Positioning blocks the gesture: create one there and send it, or note a free Interaction', async () => {
  await desktop();
  const api = sendApi();
  const { router } = await renderApp(`/contacts/${PAUL.id}?send=positioning`, api);
  const dialog = page.getByRole('dialog', { name: 'Envoyer à Paul Durand' });
  await expect
    .element(dialog)
    .toHaveTextContent("Aucun Positionnement pour l'Étape Qualification.");
  await expect
    .element(dialog.getByRole('button', { name: "C'est envoyé" }))
    .not.toBeInTheDocument();

  await dialog.getByRole('button', { name: 'Noter une Interaction libre' }).click();
  await expect
    .element(page.getByRole('dialog', { name: 'Noter une Interaction avec Paul Durand' }))
    .toBeVisible();
  expect(router.state.location.search).toEqual({ interaction: 'note' });
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();

  await userEvent.keyboard('u');
  await page.getByRole('button', { name: 'Créer un Positionnement pour cette Étape' }).click();
  const creation = page.getByRole('dialog', { name: 'Nouveau Positionnement' });
  await expect.element(creation).toHaveTextContent('Étape · Qualification');
  await creation.getByRole('textbox', { name: 'Libellé' }).fill('Mail de qualification');
  await creation.getByRole('button', { name: "Créer et l'envoyer à Paul Durand" }).click();

  const back = page.getByRole('dialog', { name: 'Envoyer à Paul Durand' });
  await expect.element(back.getByText('Mail de qualification')).toBeVisible();
  await expect.element(back.getByRole('button', { name: "C'est envoyé" })).toBeVisible();
});

test('Ctrl Enter in the quick add adds the Contact Prospecting and goes on to send it a Positioning', async () => {
  await desktop();
  const added = prospect({ id: '01990000-0000-7000-8000-000000000006', name: 'Nina Roux' });
  const api = sendApi({
    'POST /api/contacts': () =>
      Response.json(
        { changes: changes({ contacts: [added] }), undoToken: UNDO_TOKEN },
        { status: 201 },
      ),
    [`GET /api/contacts/${added.id}/record`]: () => Response.json({ note: null, thread: [] }),
  });
  const { router } = await renderApp('/contacts', api);
  await expect.element(page.getByRole('heading', { level: 1, name: 'Contacts' })).toBeVisible();

  await userEvent.keyboard('n');
  await page.getByRole('dialog').getByRole('textbox', { name: 'Nom' }).fill('Nina Roux');
  await userEvent.keyboard('{Control>}{Enter}{/Control}');

  await expect.element(page.getByRole('dialog', { name: 'Envoyer à Nina Roux' })).toBeVisible();
  expect(api.sent('POST /api/contacts')[0]?.body).toMatchObject({
    name: 'Nina Roux',
    status: 'prospecting',
    stageId: OUTREACH.id,
  });
  expect(router.state.location.pathname).toBe(`/contacts/${added.id}`);
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing on the panel “Send to”, in the %s theme',
  async (scheme) => {
    await commands.emulateColorScheme(scheme);
    await desktop();
    await renderApp(`/contacts/${LEA.id}?send=positioning`, sendApi());
    await expect.element(page.getByRole('dialog', { name: 'Envoyer à Léa Bernard' })).toBeVisible();
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');

    await expectNoAxeViolations();
  },
);
