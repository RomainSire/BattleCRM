import { addDays, localDay } from '@battlecrm/domain';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import { changes, contact, organization, summary } from '../../test/summary.ts';
import type { SummaryContact, SummarySettings } from '../summary.ts';

const desktop = () => page.viewport(1280, 800);
const phone = () => page.viewport(390, 800);

const TIME_ZONE = 'Europe/Paris';
/** Today for the User, as the SPA reads it. */
const today = () => localDay(new Date(), TIME_ZONE);
/** A local day as the User reads it. */
const shown = (day: string) =>
  new Intl.DateTimeFormat('fr', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );
/** A Follow-up's day as a row of the Circle shows it: “mer. 14 oct.”. */
const weekDay = (day: string) =>
  new Intl.DateTimeFormat('fr', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));

const CAPGEMINI = organization({ id: '01990000-0000-7000-8000-0000000000c1', name: 'Capgemini' });

/** An Ally last in touch some days ago. */
const ally = (fields: Partial<SummaryContact>, daysAgo: number) =>
  contact({
    status: 'ally',
    lastInteractionAt: '2026-01-05T09:00:00.000Z',
    lastInteractionOn: addDays(today(), -daysAgo),
    lastDoneInteractionOn: addDays(today(), -daysAgo),
    ...fields,
  });

/** Past the Rhythm of 28 days. */
const ines = () =>
  ally(
    {
      id: '01990000-0000-7000-8000-000000000001',
      name: 'Inès Moreau',
      organizationId: CAPGEMINI.id,
    },
    30,
  );
/** In the last 7 days of the Rhythm. */
const paul = () => ally({ id: '01990000-0000-7000-8000-000000000002', name: 'Paul Girard' }, 24);
/** Long silent, but a Follow-up to come puts it up to date. */
const sara = () =>
  ally(
    {
      id: '01990000-0000-7000-8000-000000000003',
      name: 'Sara Lopez',
      followUp: { dueOn: addDays(today(), 5), note: null, rank: null },
    },
    40,
  );
/** Just in touch, but its Follow-up is overdue. */
const tom = () =>
  ally(
    {
      id: '01990000-0000-7000-8000-000000000004',
      name: 'Tom Blanc',
      followUp: { dueOn: addDays(today(), -1), note: 'Demander la mission', rank: null },
    },
    2,
  );
/** In the Pool: a Contact to add to the Circle. */
const JEAN = contact({ id: '01990000-0000-7000-8000-000000000005', name: 'Jean Dupont' });

const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';
const UNDO_ROUTE = `POST /api/gestures/${UNDO_TOKEN}/undo`;
const checkInRoute = (id: string) => `POST /api/contacts/${id}/check-in`;

/** An API that records Check-ins as the server would, and takes them back. */
function circleApi({
  contacts = [ines(), paul(), sara(), tom(), JEAN],
  settings = {},
}: { contacts?: SummaryContact[]; settings?: Partial<SummarySettings> } = {}) {
  let undone: SummaryContact | undefined;
  const routes: Parameters<typeof fakeApi>[0] = {
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: TIME_ZONE,
          settings: { activityGoal: { inEffect: 3, chosen: 3 }, ...settings },
          contacts,
          organizations: [CAPGEMINI],
        }),
      ),
    [UNDO_ROUTE]: () => Response.json({ changes: changes({ contacts: undone ? [undone] : [] }) }),
  };
  for (const before of contacts) {
    routes[`GET /api/contacts/${before.id}/record`] = () =>
      Response.json({ note: null, thread: [] });
    routes[checkInRoute(before.id)] = (body) => {
      const { occurredOn, cancelFollowUp } = z
        .strictObject({
          channel: z.enum(['email', 'linkedin', 'phone', 'meeting', 'other']),
          occurredOn: z.iso.date(),
          note: z.string().optional(),
          cancelFollowUp: z.literal(true).optional(),
        })
        .parse(body);
      undone = before;
      return Response.json({
        changes: changes({
          contacts: [
            {
              ...before,
              lastDoneInteractionOn: occurredOn,
              prospectingActionDays: [occurredOn],
              ...(cancelFollowUp && { followUp: null }),
            },
          ],
        }),
        undoToken: UNDO_TOKEN,
      });
    };
  }
  return fakeApi(routes);
}

const tier = (name: RegExp) => page.getByRole('region', { name });

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(async () => {
  await commands.emulateColorScheme('light');
});

test('the Circle counts its Allies against the size goal and ranks them in three tiers, the days always written', async () => {
  await desktop();
  await renderApp('/circle', circleApi());

  await expect.element(page.getByText('4 Alliés sur 10 visés')).toBeInTheDocument();
  expect(document.querySelectorAll('[data-circle-dot="filled"]')).toHaveLength(4);
  expect(document.querySelectorAll('[data-circle-dot="empty"]')).toHaveLength(6);
  const due = tier(/^À relancer/);
  await expect.element(due.getByRole('heading')).toHaveTextContent('À relancer (2)');
  // The most Days since contact first.
  expect(
    due
      .getByRole('listitem')
      .elements()
      .map((row) => row.textContent),
  ).toEqual([expect.stringContaining('Inès Moreau'), expect.stringContaining('Tom Blanc')]);
  const inesRow = due.getByRole('listitem').first();
  await expect.element(inesRow).toHaveTextContent('Capgemini · ESN');
  await expect.element(inesRow).toHaveTextContent('30 j sans contact');
  await expect
    .element(inesRow)
    .toHaveTextContent(`dernière Interaction le ${shown(addDays(today(), -30))}`);
  // The Follow-up due is followed up; the Rhythm past calls for a Check-in.
  const tomRow = due.getByRole('listitem').nth(1);
  await expect
    .element(tomRow)
    .toHaveTextContent(`Relance due depuis ${weekDay(addDays(today(), -1))}`);
  await expect.element(tomRow.getByRole('button', { name: 'Relancer…' })).toBeVisible();
  await expect
    .element(inesRow.getByRole('button', { name: 'Prendre des nouvelles…' }))
    .toBeVisible();

  await expect.element(tier(/^Bientôt/).getByRole('heading')).toHaveTextContent('Bientôt (1)');
  await expect.element(tier(/^Bientôt/)).toHaveTextContent('Paul Girard');
  // A Follow-up to come comes before the Rhythm: up to date, however long the silence.
  const upToDate = tier(/^À jour/);
  await expect.element(upToDate).toHaveTextContent('Sara Lopez');
  await expect.element(upToDate).toHaveTextContent('40 j sans contact');
  await expect.element(upToDate).toHaveTextContent(`Relance ${weekDay(addDays(today(), 5))}`);
  expect(document.body.textContent).not.toContain('Jean Dupont');
});

test('Check in… from a row: its Channel, day and note, +1 to the Activity and the Days since contact back to 0; then “Undo”', async () => {
  await desktop();
  const api = circleApi();
  await renderApp('/circle', api);
  await tier(/^À relancer/)
    .getByRole('button', { name: 'Prendre des nouvelles…' })
    .first()
    .click();

  const dialog = page.getByRole('dialog', { name: 'Prendre des nouvelles de Inès Moreau' });
  const nextOn = shown(addDays(today(), 28));
  await expect.element(dialog).toHaveTextContent("+1 à l'Activité d'aujourd'hui (1/3)");
  await expect
    .element(dialog)
    .toHaveTextContent(`Jours sans contact remis à 0 · prochaines nouvelles d'ici le ${nextOn}`);
  const note = dialog.getByRole('textbox', { name: 'Note (facultative)' });
  await expect.element(note).toHaveFocus();
  await dialog.getByText('Rencontre').click();
  await note.fill(' Café à la gare ');
  await userEvent.keyboard('{Enter}');

  await expect
    .element(page.getByText(`Nouvelles de Inès Moreau notées · prochaines d'ici le ${nextOn}`))
    .toBeVisible();
  expect(api.sent(checkInRoute(ines().id)).map(({ body }) => body)).toEqual([
    { channel: 'meeting', occurredOn: today(), note: 'Café à la gare' },
  ]);
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(tier(/^À jour/)).toHaveTextContent('Inès Moreau');
  await expect.element(tier(/^À jour/)).toHaveTextContent('0 j sans contact');

  await page.getByRole('button', { name: /^Annuler$/ }).click();
  await expect.element(page.getByText('Annulé.')).toBeVisible();
  expect(api.sent(UNDO_ROUTE)).toHaveLength(1);
  await expect.element(tier(/^À relancer/)).toHaveTextContent('Inès Moreau');
});

test('Check in… keeps a Follow-up to come by default, or cancels it', async () => {
  await desktop();
  const api = circleApi();
  await renderApp(`/circle?contact=${sara().id}&interaction=check-in`, api);
  const dialog = page.getByRole('dialog', { name: 'Prendre des nouvelles de Sara Lopez' });
  const date = shown(addDays(today(), 5));
  await expect
    .element(dialog.getByRole('radio', { name: `Garder la Relance du ${date}` }))
    .toBeChecked();
  // Kept, the Follow-up calls the Ally back before the Rhythm does.
  await expect.element(dialog).toHaveTextContent(`prochaines nouvelles d'ici le ${date}`);
  await expect
    .element(dialog.getByRole('checkbox', { name: 'Planifier une Relance…' }))
    .not.toBeInTheDocument();

  await dialog.getByText("L'annuler").click();
  await expect.element(dialog).toHaveTextContent(`La Relance du ${date} est annulée`);
  await dialog.getByRole('button', { name: 'Noter les nouvelles' }).click();

  await expect.element(dialog).not.toBeInTheDocument();
  expect(api.sent(checkInRoute(sara().id)).map(({ body }) => body)).toEqual([
    { channel: 'email', occurredOn: today(), cancelFollowUp: true },
  ]);
});

test('the whole row opens the record of the Ally in a panel: Ally · n d since contact, its gauge, Check in… in full, `I` and `F` too', async () => {
  await desktop();
  const { router } = await renderApp('/circle', circleApi());
  // Anywhere on the row, its gauge too, not only its name.
  const row = tier(/^Bientôt/).getByRole('listitem');
  await expect.element(row).toBeVisible();
  const gauge = row.element().querySelector('[data-rhythm-gauge]')?.getBoundingClientRect();
  const box = row.element().getBoundingClientRect();
  await row.click({
    position: { x: (gauge?.x ?? 0) - box.x + 10, y: (gauge?.y ?? 0) - box.y + 1 },
  });

  const panel = page.getByRole('region', { name: /^Paul Girard/ });
  await expect
    .element(page.getByRole('link', { name: /^Paul Girard/ }))
    .toHaveAttribute('aria-current', 'page');
  await expect.element(panel).toHaveTextContent('Allié · 24 j sans contact');
  await expect.element(panel).toHaveTextContent('Bientôt');
  expect(panel.element().querySelector('[data-rhythm-gauge="soon"]')).not.toBeNull();
  await expect
    .element(panel.getByRole('button', { name: 'Noter une Interaction' }))
    .not.toBeInTheDocument();

  await panel.getByRole('button', { name: 'Prendre des nouvelles…' }).click();
  await expect
    .element(page.getByRole('dialog', { name: 'Prendre des nouvelles de Paul Girard' }))
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  await panel.getByRole('heading', { name: /^Paul Girard/ }).click();
  await userEvent.keyboard('f');
  expect(router.state.location.search).toMatchObject({ interaction: 'check-in' });
});

test('on the record of an Ally whose Follow-up is due: Follow up… in full, Check in… beside it; `F` follows up, `I` checks in', async () => {
  await desktop();
  const { router } = await renderApp(`/contacts/${tom().id}`, circleApi());
  await expect.element(page.getByRole('heading', { level: 1, name: /Tom Blanc/ })).toBeVisible();
  await expect
    .element(page.getByText(/^Allié · 2 j sans contact · Relance en retard depuis le/))
    .toBeVisible();
  await expect.element(page.getByRole('button', { name: 'Relancer…' }).first()).toBeVisible();
  await expect.element(page.getByRole('button', { name: 'Prendre des nouvelles…' })).toBeVisible();

  await userEvent.keyboard('f');
  expect(router.state.location.search).toEqual({ followUp: 'do' });
  await userEvent.keyboard('{Escape}');
  await userEvent.keyboard('i');
  expect(router.state.location.search).toEqual({ interaction: 'check-in' });
  // Its Follow-up due stays the only one: none to schedule from here.
  await expect
    .element(page.getByRole('dialog', { name: 'Prendre des nouvelles de Tom Blanc' }))
    .toBeVisible();
  await expect
    .element(page.getByRole('checkbox', { name: 'Planifier une Relance…' }))
    .not.toBeInTheDocument();
});

test('Add to Circle…: a Contact chosen as it is typed, the Allies aside, then the window of the change of Status', async () => {
  await desktop();
  const { router } = await renderApp('/circle', circleApi());
  await page.getByRole('button', { name: 'Ajouter au Cercle…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter au Cercle…' });
  const field = dialog.getByRole('combobox', { name: 'Contact' });
  await expect.element(field).toHaveFocus();

  await userEvent.keyboard('Inès');
  // An Ally is never proposed: only the quick add of the name typed.
  await expect.element(page.getByRole('option')).toHaveAccessibleName('Ajouter « Inès » en Allié');
  await field.fill('jean');
  await page.getByRole('option', { name: 'Jean Dupont' }).click();

  await expect
    .element(page.getByRole('dialog', { name: 'Ajouter Jean Dupont au Cercle' }))
    .toBeVisible();
  expect(router.state.location.search).toEqual({ contact: JEAN.id, statusTo: 'ally' });
});

test('Add to Circle… without a match proposes the quick add of an Ally, its name typed', async () => {
  await desktop();
  await renderApp('/circle', circleApi());
  await page.getByRole('button', { name: 'Ajouter au Cercle…' }).click();
  await userEvent.keyboard('Nina Roux');

  await page.getByRole('option', { name: 'Ajouter « Nina Roux » en Allié' }).click();

  const quickAdd = page.getByRole('dialog', { name: 'Ajouter un Contact' });
  await expect.element(quickAdd.getByRole('textbox', { name: 'Nom' })).toHaveValue('Nina Roux');
  await expect.element(quickAdd.getByRole('radio', { name: 'Allié' })).toBeChecked();
});

test('without a size goal, the count alone; an empty Circle says what it is for', async () => {
  await desktop();
  await renderApp('/circle', circleApi({ settings: { circleSizeGoal: null } }));
  await expect.element(page.getByText('4 Alliés', { exact: true })).toBeVisible();
  expect(document.querySelectorAll('[data-circle-dot]')).toHaveLength(0);
});

test('an empty Circle: 0/10, what it is for, Add to Circle…, and the record as another way', async () => {
  await desktop();
  await renderApp('/circle', circleApi({ contacts: [JEAN] }));
  await expect.element(page.getByText('0 Alliés sur 10 visés')).toBeInTheDocument();
  await expect
    .element(page.getByText(/^Ton Cercle est vide\. Ajoute les ingénieurs d'affaires/))
    .toBeVisible();
  await expect.element(page.getByRole('button', { name: 'Ajouter au Cercle…' })).toBeVisible();
  await expect
    .element(page.getByText("Tu peux aussi le faire depuis la fiche d'un Contact."))
    .toBeVisible();
});

test('on a phone, the same Allies in cards with their gauge; the name opens the record as a page', async () => {
  await phone();
  const { router } = await renderApp('/circle', circleApi());
  await expect.element(tier(/^À relancer/)).toHaveTextContent('30 j sans contact');
  expect(document.querySelectorAll('[data-rhythm-gauge]')).toHaveLength(4);

  await page.getByRole('link', { name: /^Inès Moreau/ }).click();

  await expect.poll(() => router.state.location.pathname).toBe(`/contacts/${ines().id}`);
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing on the Circle and in Check in…, in the %s theme',
  async (scheme) => {
    await commands.emulateColorScheme(scheme);
    await desktop();
    await renderApp('/circle', circleApi());
    await expect.element(tier(/^Bientôt/)).toBeVisible();
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');
    await expectNoAxeViolations();

    await tier(/^À jour/)
      .getByRole('button', { name: 'Prendre des nouvelles…' })
      .click();
    await expect.element(page.getByRole('dialog')).toBeVisible();
    await expectNoAxeViolations();
  },
);
