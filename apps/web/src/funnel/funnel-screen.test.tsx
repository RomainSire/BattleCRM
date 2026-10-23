import { addDays, localDay } from '@battlecrm/domain';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import {
  battle,
  changes,
  contact,
  organization,
  positioning,
  stage,
  summary,
} from '../../test/summary.ts';
import type { SummaryContact } from '../summary.ts';

const desktop = () => page.viewport(1400, 900);

const TIME_ZONE = 'Europe/Paris';
const today = () => localDay(new Date(), TIME_ZONE);

const OUTREACH = stage({
  id: '01990000-0000-7000-8000-000000000011',
  name: 'Approche',
  aim: 'CV à envoyer',
});
const AGENCY = stage({ id: '01990000-0000-7000-8000-000000000012', name: 'Qualif ESN' });
const OLD = stage({ id: '01990000-0000-7000-8000-000000000013', name: 'Salon', archived: true });
const CV = positioning({
  id: '01990000-0000-7000-8000-000000000021',
  stageId: OUTREACH.id,
  label: 'CV Rust',
});
const CALL = positioning({
  id: '01990000-0000-7000-8000-000000000022',
  stageId: OUTREACH.id,
  label: 'Appel',
  channel: 'phone',
});
const BATTLE = battle({
  id: '01990000-0000-7000-8000-000000000041',
  stageId: OUTREACH.id,
  championId: CV.id,
  challengerId: CALL.id,
  trials: {
    champion: { successes: 1, noResults: 2, inProgress: 1 },
    challenger: { successes: 0, noResults: 1, inProgress: 2 },
  },
});
const CAPGEMINI = organization({ id: '01990000-0000-7000-8000-000000000031', name: 'Capgemini' });
const ACME = organization({
  id: '01990000-0000-7000-8000-000000000032',
  name: 'Acme',
  type: 'end_client',
});

const CLAIRE_ID = '01990000-0000-7000-8000-000000000001';
const prospecting = (fields: Partial<SummaryContact>) =>
  contact({ status: 'prospecting', stageId: OUTREACH.id, ...fields });

/** Claire: Follow-up 2 overdue by three days, at Capgemini. */
const claire = () =>
  prospecting({
    id: CLAIRE_ID,
    name: 'Claire Martin',
    organizationId: CAPGEMINI.id,
    followUp: { dueOn: addDays(today(), -3), note: null, rank: 2 },
  });
/** Paul: a Trial in progress past its Response window. */
const paul = () =>
  prospecting({
    id: '01990000-0000-7000-8000-000000000002',
    name: 'Paul Durand',
    organizationId: ACME.id,
    trial: {
      battleId: BATTLE.id,
      positioningId: CV.id,
      startedOn: addDays(today(), -30),
      overridden: false,
    },
    lastDoneInteractionOn: addDays(today(), -20),
  });
/** Léa: Follow-up 1 today. */
const lea = () =>
  prospecting({
    id: '01990000-0000-7000-8000-000000000003',
    name: 'Léa Petit',
    followUp: { dueOn: today(), note: null, rank: 1 },
  });
/** Marc: nothing next, at a Stage with Positionings. */
const marc = () => prospecting({ id: '01990000-0000-7000-8000-000000000004', name: 'Marc Roy' });
/** Inès: at a Stage without a Positioning, so Waiting. */
const ines = () =>
  prospecting({
    id: '01990000-0000-7000-8000-000000000005',
    name: 'Inès Haddad',
    stageId: AGENCY.id,
  });
/** Hugo: in the Pool, out of the Funnel. */
const hugo = () =>
  contact({ id: '01990000-0000-7000-8000-000000000006', name: 'Hugo Blanc', stageId: OUTREACH.id });

const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';

function funnelApi(contacts: SummaryContact[] = [claire(), paul(), lea(), marc(), ines(), hugo()]) {
  return fakeApi({
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: TIME_ZONE,
          contacts,
          stages: [OUTREACH, AGENCY, OLD],
          organizations: [CAPGEMINI, ACME],
          positionings: [CV, CALL],
          battles: [BATTLE],
        }),
      ),
    [`GET /api/contacts/${CLAIRE_ID}/record`]: () => Response.json({ note: null, thread: [] }),
    [`POST /api/contacts/${marc().id}/change-stage`]: () =>
      Response.json({
        changes: changes({ contacts: [{ ...marc(), stageId: AGENCY.id }] }),
        undoToken: UNDO_TOKEN,
      }),
    [`POST /api/gestures/${UNDO_TOKEN}/undo`]: () =>
      Response.json({ changes: changes({ contacts: [marc()] }) }),
    [`POST /api/contacts/${CLAIRE_ID}/cancel-follow-up`]: () =>
      Response.json({
        changes: changes({ contacts: [{ ...claire(), followUp: null }] }),
        undoToken: UNDO_TOKEN,
      }),
  });
}

/** The grid of a Stage, and the row of a Contact in it. */
const column = (name: string) => page.getByRole('grid', { name });
const card = (name: string) => page.getByRole('row', { name: new RegExp(name) });

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(async () => {
  await commands.emulateColorScheme('light');
});

test('a column per Stage of the Funnel, its open Battle in its head; the Contacts Prospecting in the rows Needs action, Waiting, No next step, by urgency', async () => {
  await desktop();
  await renderApp('/funnel', funnelApi());

  await expect.element(column('Approche')).toBeVisible();
  await expect.element(column('Qualif ESN')).toBeVisible();
  // An archived Stage is out of the Funnel; a Contact of the Pool too.
  expect(column('Salon').elements()).toEqual([]);
  expect(page.getByText('Hugo Blanc').elements()).toEqual([]);

  const head = page.getByRole('heading', { name: 'Approche' }).element()
    .parentElement?.parentElement;
  expect(head?.textContent).toContain('CV à envoyer');
  expect(head?.textContent).toContain('4 Contacts');
  expect(head?.textContent).toContain('Battle : CV Rust 4/25 vs Appel 3/25');

  const needsAction = column('Approche').getByRole('rowgroup', { name: 'À traiter' });
  // The rows of the cards, past the header of the row.
  const rows = needsAction
    .getByRole('row')
    .elements()
    .filter((row) => row.hasAttribute('data-key'));
  expect(rows.map((row) => row.textContent)).toEqual([
    expect.stringContaining('Claire Martin'),
    expect.stringContaining('Léa Petit'),
    expect.stringContaining('Paul Durand'),
  ]);
  await expect.element(card('Claire Martin')).toHaveTextContent('Relance 2 · en retard · 3 j');
  await expect.element(card('Claire Martin')).toHaveTextContent('Capgemini · ESN');
  await expect.element(card('Léa Petit')).toHaveTextContent("Relance 1 · aujourd'hui");
  await expect.element(card('Paul Durand')).toHaveTextContent('Essai « CV Rust » · délai dépassé');
  await expect
    .element(column('Approche').getByRole('rowgroup', { name: 'Sans prochaine action' }))
    .toHaveTextContent('Marc Roy');
  await expect
    .element(column('Qualif ESN').getByRole('rowgroup', { name: 'En attente' }))
    .toHaveTextContent('Inès Haddad');
  await expect.element(card('Inès Haddad')).toHaveTextContent('Aucun Positionnement à cette Étape');

  await expectNoAxeViolations();
  await commands.emulateColorScheme('dark');
  await expectNoAxeViolations();
});

test('today is the User’s, in the time zone of the summary, not the device’s', async () => {
  await desktop();
  const zone = 'Pacific/Kiritimati';
  const theirToday = localDay(new Date(), zone);
  const api = fakeApi({
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: zone,
          contacts: [
            prospecting({
              name: 'Léa Petit',
              followUp: { dueOn: theirToday, note: null, rank: 1 },
            }),
          ],
          stages: [OUTREACH],
          positionings: [CV],
        }),
      ),
  });
  await renderApp('/funnel', api);

  await expect.element(card('Léa Petit')).toHaveTextContent("Relance 1 · aujourd'hui");
});

test('the shortcuts of a card are those of Today: “Follow up…” opens its panel, “Cancel” cancels the Follow-up with “Undo”', async () => {
  await desktop();
  const api = funnelApi();
  await renderApp('/funnel', api);

  await card('Claire Martin').getByRole('button', { name: 'Relancer…' }).click();
  await expect.element(page.getByRole('dialog', { name: 'Relancer Claire Martin' })).toBeVisible();
  await userEvent.keyboard('{Escape}');

  await card('Claire Martin').getByRole('button', { name: 'Annuler la Relance' }).click();
  expect(api.sent(`POST /api/contacts/${CLAIRE_ID}/cancel-follow-up`)).toHaveLength(1);
  await expect.element(page.getByRole('button', { name: 'Annuler', exact: true })).toBeVisible();

  await card('Paul Durand').getByRole('button', { name: 'Sans suite…' }).click();
  await expect
    .element(page.getByRole('dialog', { name: 'Essai sans suite · Paul Durand' }))
    .toBeVisible();
});

test('the menu ⋯ of a card opens the changes of Stage and Status, and the record in a panel beside the kanban, not modal', async () => {
  await desktop();
  await renderApp('/funnel', funnelApi());

  await page.getByRole('button', { name: 'Actions de Claire Martin' }).click();
  await page.getByRole('menuitem', { name: 'Remettre au Vivier…' }).click();
  await expect
    .element(page.getByRole('dialog', { name: 'Remettre Claire Martin au Vivier' }))
    .toBeVisible();
  await userEvent.keyboard('{Escape}');

  await page.getByRole('button', { name: 'Actions de Claire Martin' }).click();
  await page.getByRole('menuitem', { name: 'Ouvrir la fiche' }).click();
  const heading = page.getByRole('heading', { name: 'Claire Martin', level: 2 });
  await expect.element(heading).toHaveFocus();
  expect(page.getByRole('dialog').elements()).toEqual([]);
  await expect.element(column('Approche')).toBeVisible();
  await expectNoAxeViolations();
});

test('on a card that has the focus, E opens “Change stage…”, S “Change status…”; the arrows go from card to card, across the columns', async () => {
  await desktop();
  await renderApp('/funnel', funnelApi());

  await card('Claire Martin').getByText('Claire Martin').click();
  await expect.element(card('Claire Martin')).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}');
  await expect.element(card('Léa Petit')).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}');
  await expect.element(card('Inès Haddad')).toHaveFocus();
  // Back to the card of the column beside that is closest in height.
  await userEvent.keyboard('{ArrowLeft}');
  await expect.element(card('Marc Roy')).toHaveFocus();
  await userEvent.keyboard('e');
  const stageDialog = page.getByRole('dialog', { name: "Changer Marc Roy d'Étape" });
  await expect.element(stageDialog).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(stageDialog).not.toBeInTheDocument();
  // Closing gives the focus back to the card, after the dialog is gone.
  await expect.element(card('Marc Roy')).toHaveFocus();

  await userEvent.keyboard('s');
  await expect
    .element(page.getByRole('dialog', { name: "Changer l'État de Marc Roy" }))
    .toBeVisible();
});

test('a card dragged with the keyboard onto another Stage opens the window of consequences, set to that Stage', async () => {
  await desktop();
  const { router } = await renderApp('/funnel', funnelApi());

  await card('Marc Roy').getByText('Marc Roy').click();
  await userEvent.keyboard('{Tab}');
  await expect.element(page.getByRole('button', { name: 'Déplacer Marc Roy' })).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  // Tab goes from drop target to drop target, the nearest first: up to the column of Qualif ESN.
  const agencyGrid = column('Qualif ESN').element();
  for (let tabs = 0; !agencyGrid.contains(document.activeElement) && tabs < 6; tabs += 1) {
    await userEvent.keyboard('{Tab}');
  }
  await userEvent.keyboard('{Enter}');

  const dialog = page.getByRole('dialog', { name: "Changer Marc Roy d'Étape" });
  await expect.element(dialog).toBeVisible();
  await expect
    .element(dialog.getByRole('combobox', { name: 'Nouvelle Étape' }))
    .toHaveDisplayValue('Avancer à Qualif ESN');
  expect(router.state.location.search).toMatchObject({ stageTo: AGENCY.id });
});

test('the filters keep the Contacts by name or Organization, Target, Battle, Organization and signal', async () => {
  await desktop();
  await renderApp('/funnel', funnelApi());

  await page.getByRole('searchbox', { name: 'Nom ou Organisation' }).fill('capgem');
  await expect.element(card('Claire Martin')).toBeVisible();
  await expect.element(card('Léa Petit')).not.toBeInTheDocument();
  await page.getByRole('searchbox', { name: 'Nom ou Organisation' }).fill('');

  await page.getByRole('combobox', { name: 'Cible' }).selectOptions('Client final');
  await expect.element(card('Paul Durand')).toBeVisible();
  await expect.element(card('Claire Martin')).not.toBeInTheDocument();
  await page.getByRole('combobox', { name: 'Cible' }).selectOptions('Tous');

  await page.getByRole('combobox', { name: 'Battle' }).selectOptions('Essai « CV Rust »');
  await expect.element(card('Paul Durand')).toBeVisible();
  await expect.element(card('Marc Roy')).not.toBeInTheDocument();
  await page.getByRole('combobox', { name: 'Battle' }).selectOptions('Tous');

  await page.getByRole('combobox', { name: 'Signal' }).selectOptions('Sans prochaine action');
  await expect.element(card('Marc Roy')).toBeVisible();
  await expect.element(card('Claire Martin')).not.toBeInTheDocument();

  await page.getByRole('combobox', { name: 'Organisation' }).selectOptions('Acme');
  await expect
    .element(page.getByText('Aucun Contact En prospection ne correspond aux filtres.'))
    .toBeVisible();
  await page.getByRole('button', { name: 'Effacer les filtres' }).click();
  await expect.element(card('Claire Martin')).toBeVisible();
});

test('while a card is dragged, the zones Pool, Circle and Archived appear: dropped on one, it opens the change of Status set to it', async () => {
  await desktop();
  await renderApp('/funnel', funnelApi());
  expect(page.getByRole('group', { name: "Changer d'État" }).elements()).toEqual([]);

  await card('Claire Martin').getByText('Claire Martin').click();
  await userEvent.keyboard('{Tab}');
  await userEvent.keyboard('{Enter}');
  const zones = page.getByRole('group', { name: "Changer d'État" });
  await expect.element(zones).toHaveTextContent('VivierCercleArchivé');
  const circle = zones.getByRole('button', { name: 'Ajouter au Cercle…' }).element();
  for (let tabs = 0; document.activeElement !== circle && tabs < 6; tabs += 1) {
    await userEvent.keyboard('{Tab}');
  }
  await userEvent.keyboard('{Enter}');

  await expect
    .element(page.getByRole('dialog', { name: 'Ajouter Claire Martin au Cercle' }))
    .toBeVisible();
  await expect.element(zones).not.toBeInTheDocument();
});

test('a card dragged with the mouse onto another column opens the window of consequences; validated, it moves, with “Undo”', async () => {
  await desktop();
  const api = funnelApi();
  await renderApp('/funnel', api);

  await userEvent.dragAndDrop(card('Marc Roy'), column('Qualif ESN'));

  const dialog = page.getByRole('dialog', { name: "Changer Marc Roy d'Étape" });
  await dialog.getByRole('button', { name: "Changer d'Étape" }).click();
  expect(api.sent(`POST /api/contacts/${marc().id}/change-stage`).map(({ body }) => body)).toEqual([
    { stageId: AGENCY.id },
  ]);
  await expect.element(column('Qualif ESN')).toHaveTextContent('Marc Roy');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  expect(api.sent(`POST /api/gestures/${UNDO_TOKEN}/undo`)).toHaveLength(1);
  await expect.element(column('Approche')).toHaveTextContent('Marc Roy');
});

test('the menu of a column leads to the Funnel in Settings, to rename or manage the Stages', async () => {
  await desktop();
  const { router } = await renderApp('/funnel', funnelApi());

  await page.getByRole('button', { name: "Actions de l'Étape Approche" }).click();
  await page.getByRole('menuitem', { name: 'Renommer' }).click();

  await expect.poll(() => router.state.location.pathname).toBe('/settings');
  expect(router.state.location.hash).toBe('funnel');
});
