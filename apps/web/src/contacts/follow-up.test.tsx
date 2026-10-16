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
/** Today for the User, as the SPA reads it: what a Follow-up is due on. */
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
/** Prospecting, her Follow-up two days overdue; she was followed up once already. */
const julie = () =>
  prospect({
    id: '01990000-0000-7000-8000-000000000001',
    name: 'Julie Martin',
    followUp: { dueOn: addDays(today(), -2), note: 'Relancer sur le devis', rank: null },
  });
/** An Ally whose Follow-up is to come. */
const ines = () =>
  prospect({
    id: '01990000-0000-7000-8000-000000000003',
    name: 'Inès Moreau',
    status: 'ally',
    followUp: { dueOn: addDays(today(), 5), note: null, rank: null },
  });
const LEA = prospect({
  id: '01990000-0000-7000-8000-000000000004',
  name: 'Léa Bernard',
  status: 'pool',
});

const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';
const UNDO_ROUTE = `POST /api/gestures/${UNDO_TOKEN}/undo`;
const scheduleRoute = (id: string) => `POST /api/contacts/${id}/schedule-follow-up`;
const cancelRoute = (id: string) => `POST /api/contacts/${id}/cancel-follow-up`;
const followUpRoute = (id: string) => `POST /api/contacts/${id}/follow-up`;

/** Julie's thread: the last time she was followed up, with what was sent. */
const thread = (id: string) => ({
  note: null,
  thread:
    id === julie().id
      ? [
          {
            id: '01990000-0000-7000-8000-000000000031',
            kind: 'follow_up',
            direction: 'outbound',
            occurredAt: '2026-01-08T09:00:00.000Z',
            localDate: '2026-01-08',
            note: 'Envoyé le cas client',
            statusChange: null,
          },
        ]
      : [],
});

/** An API that schedules, cancels and does Follow-ups as the server would, and takes them back. */
function followUpApi(
  activityGoal: number | null = 3,
  overrides: Parameters<typeof fakeApi>[0] = {},
) {
  const contacts = [MARC, julie(), ines(), LEA];
  // Two Prospecting actions today already, on another Contact.
  contacts.push(
    prospect({
      id: '01990000-0000-7000-8000-000000000005',
      name: 'Paul Durand',
      prospectingActionDays: [today(), today()],
    }),
  );
  // What “Undo” gives back: the Contact as it was before the latest gesture.
  let undone: SummaryContact = MARC;
  const routes: Parameters<typeof fakeApi>[0] = {
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: TIME_ZONE,
          settings: { activityGoal: { inEffect: activityGoal, chosen: activityGoal } },
          contacts,
          stages: [OUTREACH],
        }),
      ),
    [UNDO_ROUTE]: () => Response.json({ changes: changes({ contacts: [undone] }) }),
  };
  for (const before of contacts) {
    routes[`GET /api/contacts/${before.id}/record`] = () => Response.json(thread(before.id));
    routes[scheduleRoute(before.id)] = (body) => {
      const { dueOn, note } = z
        .strictObject({ dueOn: z.iso.date(), note: z.string().optional() })
        .parse(body);
      undone = before;
      return Response.json({
        changes: changes({
          contacts: [
            {
              ...before,
              followUp: { dueOn, note: note ?? null, rank: before.followUp?.rank ?? null },
            },
          ],
        }),
        undoToken: UNDO_TOKEN,
      });
    };
    routes[cancelRoute(before.id)] = () => {
      undone = before;
      return Response.json({
        changes: changes({ contacts: [{ ...before, followUp: null }] }),
        undoToken: UNDO_TOKEN,
      });
    };
    routes[followUpRoute(before.id)] = (body) => {
      const { occurredOn } = z
        .strictObject({ occurredOn: z.iso.date(), note: z.string().optional() })
        .parse(body);
      undone = before;
      return Response.json({
        changes: changes({
          contacts: [
            {
              ...before,
              followUp: null,
              prospectingActionDays: [...before.prospectingActionDays, occurredOn],
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

test('without a Follow-up, the thread says nothing comes next; P schedules one off the Cadence, then “Undo”', async () => {
  await desktop();
  const api = followUpApi();
  await renderApp(`/contacts/${MARC.id}`, api);
  await expect
    .element(page.getByRole('region', { name: 'Prochaine action' }))
    .toHaveTextContent('Sans prochaine action');
  await expect.element(page.getByRole('button', { name: 'Planifier une Relance' })).toBeVisible();

  await userEvent.keyboard('p');

  const dialog = page.getByRole('dialog', { name: 'Planifier une Relance pour Marc Petit' });
  await expect.element(dialog).toBeVisible();
  // +3 d unless another day is chosen.
  await expect
    .element(dialog)
    .toHaveTextContent(`Relance le ${shown(addDays(today(), 3))} · hors Cadence`);
  await dialog.getByText('+7 j').click();
  await dialog.getByRole('textbox', { name: 'Note (facultative)' }).fill(' Demander le budget ');
  await expect
    .element(dialog)
    .toHaveTextContent(`Relance le ${shown(addDays(today(), 7))} · hors Cadence`);
  await userEvent.keyboard('{Enter}');

  await expect
    .element(page.getByText(`Relance de Marc Petit planifiée le ${shown(addDays(today(), 7))}`))
    .toBeVisible();
  expect(api.sent(scheduleRoute(MARC.id)).map(({ body }) => body)).toEqual([
    { dueOn: addDays(today(), 7), note: 'Demander le budget' },
  ]);
  await expect.element(dialog).not.toBeInTheDocument();
  const head = page.getByRole('region', { name: 'Relance · hors Cadence' });
  await expect.element(head).toHaveTextContent('Demander le budget');
  await expect
    .element(page.getByRole('region', { name: 'Prochaine action' }))
    .toHaveTextContent(`Relance le ${shown(addDays(today(), 7))}`);

  await page.getByRole('button', { name: /^Annuler$/ }).click();

  await expect.element(page.getByText('Annulé.')).toBeVisible();
  expect(api.sent(UNDO_ROUTE)).toHaveLength(1);
  await expect.element(head).not.toBeInTheDocument();
});

test('an overdue Follow-up is the action of the moment: “Follow up…” shows what to send, dates it, +1 to the Activity', async () => {
  await desktop();
  const api = followUpApi();
  await renderApp(`/contacts/${julie().id}`, api);
  const next = page.getByRole('region', { name: 'Prochaine action' });
  await expect
    .element(next)
    .toHaveTextContent(`Relance en retard depuis le ${shown(addDays(today(), -2))}`);
  const head = page.getByRole('region', { name: 'Relance · hors Cadence' });
  await expect.element(head).toHaveTextContent('En retard');
  await expect.element(head).toHaveTextContent('Relancer sur le devis');

  await next.getByRole('button', { name: 'Relancer…' }).click();

  const dialog = page.getByRole('dialog', { name: 'Relancer Julie Martin' });
  await expect.element(dialog).toHaveTextContent('Note de la Relance : Relancer sur le devis');
  await expect
    .element(dialog)
    .toHaveTextContent(
      `Dernière Interaction sortante : ${shown('2026-01-08')} · Envoyé le cas client`,
    );
  const note = dialog.getByRole('textbox', { name: 'Note (facultative)' });
  await expect.element(note).toHaveValue('Relancer sur le devis');
  await expect.element(note).toHaveFocus();
  await expect.element(dialog).toHaveTextContent("+1 à l'Activité d'aujourd'hui (3/3)");
  await note.fill('Relancée par téléphone');
  await expect.element(dialog.getByRole('radio', { name: 'Hier' })).toBeVisible();
  await dialog.getByText('Hier').click();
  await expect
    .element(dialog)
    .toHaveTextContent(`+1 à l'Activité du ${shown(addDays(today(), -1))}`);
  await dialog.getByText("Aujourd'hui").click();
  await dialog.getByRole('button', { name: 'Relancer' }).click();

  await expect
    .element(page.getByText('Relance de Julie Martin notée · Activité 3/3'))
    .toBeVisible();
  expect(api.sent(followUpRoute(julie().id)).map(({ body }) => body)).toEqual([
    { occurredOn: today(), note: 'Relancée par téléphone' },
  ]);
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(next).toHaveTextContent('Sans prochaine action');

  await page.getByRole('button', { name: /^Annuler$/ }).click();
  await expect.element(page.getByText('Annulé.')).toBeVisible();
  await expect.element(head).toBeVisible();
});

test('a day to come, or a date in the future, cannot be a Follow-up done', async () => {
  await desktop();
  const api = followUpApi(null);
  await renderApp(`/contacts/${julie().id}`, api);
  await expect.element(page.getByRole('heading', { level: 1, name: /Julie Martin/ })).toBeVisible();

  await userEvent.keyboard('f');

  const dialog = page.getByRole('dialog', { name: 'Relancer Julie Martin' });
  await expect.element(dialog).toHaveTextContent("+1 à l'Activité d'aujourd'hui (3)");
  await dialog.getByText('Une date').click();
  const day = dialog.getByLabelText('Jour', { exact: true });
  await expect.element(day).toHaveFocus();
  await day.fill(addDays(today(), 1));
  await expect.element(dialog.getByText("Choisis une date, aujourd'hui ou avant.")).toBeVisible();
  await expect.element(dialog.getByRole('button', { name: 'Relancer' })).toBeDisabled();
  await day.fill(addDays(today(), -10));
  await dialog.getByRole('button', { name: 'Relancer' }).click();
  await expect
    .element(page.getByText(`Relance de Julie Martin notée le ${shown(addDays(today(), -10))}`))
    .toBeVisible();
  expect(api.sent(followUpRoute(julie().id))[0]?.body).toEqual({
    occurredOn: addDays(today(), -10),
    note: 'Relancer sur le devis',
  });
});

test('“Edit” keeps the day and the note; “Postpone” moves it, “Cancel” takes it away, each with “Undo”', async () => {
  await desktop();
  const api = followUpApi();
  await renderApp(`/contacts/${julie().id}`, api);
  const head = page.getByRole('region', { name: 'Relance · hors Cadence' });

  await head.getByRole('button', { name: 'Modifier la Relance' }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifier la Relance de Julie Martin' });
  await expect
    .element(dialog.getByLabelText('Jour', { exact: true }))
    .toHaveValue(addDays(today(), -2));
  await expect
    .element(dialog.getByRole('textbox', { name: 'Note (facultative)' }))
    .toHaveValue('Relancer sur le devis');
  // An overdue day stays overdue: a new one must be today or later.
  await expect
    .element(dialog.getByText("Choisis une date, aujourd'hui ou plus tard."))
    .toBeVisible();
  await expect.element(dialog.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  await dialog.getByText('Demain').click();
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await expect.poll(() => api.sent(scheduleRoute(julie().id))).toHaveLength(1);
  expect(api.sent(scheduleRoute(julie().id))[0]?.body).toEqual({
    dueOn: addDays(today(), 1),
    note: 'Relancer sur le devis',
  });
  await page.getByRole('button', { name: /^Annuler$/ }).click();
  await expect.element(page.getByText('Annulé.')).toBeVisible();

  await head.getByRole('button', { name: 'Reporter la Relance' }).click();
  await page.getByRole('menuitem', { name: '+3 j' }).click();
  await expect.poll(() => api.sent(scheduleRoute(julie().id))).toHaveLength(2);
  expect(api.sent(scheduleRoute(julie().id))[1]?.body).toEqual({
    dueOn: addDays(today(), 3),
    note: 'Relancer sur le devis',
  });
  await expect
    .element(page.getByText(`Relance de Julie Martin planifiée le ${shown(addDays(today(), 3))}`))
    .toBeVisible();
  await expect.element(head).not.toHaveTextContent('En retard');

  await head.getByRole('button', { name: 'Annuler la Relance' }).click();

  await expect.element(page.getByText('Relance de Julie Martin annulée')).toBeVisible();
  expect(api.sent(cancelRoute(julie().id))).toHaveLength(1);
  await expect.element(head).not.toBeInTheDocument();
});

test('a Follow-up canceled on another device: “Cancel” says so, and the summary is read again', async () => {
  await desktop();
  const api = followUpApi(3, {
    [cancelRoute(julie().id)]: () => Response.json({ error: 'no_follow_up' }, { status: 409 }),
  });
  await renderApp(`/contacts/${julie().id}`, api);

  await page.getByRole('button', { name: 'Annuler la Relance' }).click();

  await expect
    .element(page.getByText('Ce Contact a changé sur un autre appareil : vérifie puis recommence.'))
    .toBeVisible();
  await expect.poll(() => api.sent('GET /api/summary').length).toBeGreaterThan(1);
});

test('an Ally shows its Follow-up first; leaving its Status says the Follow-up is canceled', async () => {
  await desktop();
  await renderApp(`/contacts/${ines().id}`, followUpApi());
  const next = page.getByRole('region', { name: 'Prochaine action' });
  await expect.element(next).toHaveTextContent(`Allié · Relance le ${shown(addDays(today(), 5))}`);
  // To come: not the action of the moment, but under `⋯`.
  await expect.element(next.getByRole('button', { name: 'Relancer…' })).not.toBeInTheDocument();
  await next.getByRole('button', { name: "Plus d'actions" }).click();
  await expect.element(page.getByRole('menuitem', { name: 'Relancer…' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Archiver…' }).click();

  await expect
    .element(page.getByRole('dialog', { name: 'Archiver Inès Moreau' }))
    .toHaveTextContent(`La Relance du ${shown(addDays(today(), 5))} est annulée`);
});

test('a Contact of the Pool has no Follow-up: nothing in the thread, P does nothing', async () => {
  await desktop();
  const api = followUpApi();
  const { router } = await renderApp(`/contacts/${LEA.id}`, api);
  await expect
    .element(page.getByRole('region', { name: 'Prochaine action' }))
    .toHaveTextContent('Au Vivier · dernière Étape : Approche');

  await userEvent.keyboard('p');

  expect(router.state.location.search).toEqual({});
  await expect
    .element(page.getByRole('button', { name: 'Planifier une Relance' }))
    .not.toBeInTheDocument();
  await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing on a record with an overdue Follow-up and its panel, in the %s theme',
  async (scheme) => {
    await commands.emulateColorScheme(scheme);
    await desktop();
    await renderApp(`/contacts/${julie().id}`, followUpApi());
    await expect
      .element(page.getByRole('region', { name: 'Relance · hors Cadence' }))
      .toHaveTextContent('En retard');
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');
    await expectNoAxeViolations();
    await userEvent.keyboard('f');
    await expect.element(page.getByRole('dialog')).toBeVisible();

    await expectNoAxeViolations();
  },
);
