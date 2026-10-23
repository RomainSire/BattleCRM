import { addDays, localDay } from '@battlecrm/domain';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
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
    stageEnteredOn: '2026-09-14',
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

const VIEW_KEY = 'battlecrm.funnel-view';

/** What a browser that refuses storage does. */
const refuse = (): never => {
  throw new DOMException('denied', 'SecurityError');
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.removeItem(VIEW_KEY);
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

// ——— Table (spec UX §5.2) ———

/** The table of the Funnel, and the names of its Contacts, in the order shown. */
const table = () => page.getByRole('grid', { name: 'Contacts En prospection' });
const tableNames = () =>
  table()
    .getByRole('rowheader')
    .elements()
    .map((cell) => cell.textContent);

test('V switches the Funnel to a table of the Contacts Prospecting, by urgency; the choice stays on the device, and V switches back', async () => {
  await desktop();
  await renderApp('/funnel', funnelApi());
  await card('Claire Martin').getByText('Claire Martin').click();

  await userEvent.keyboard('v');

  await expect.element(table()).toBeVisible();
  // The card that had the focus is gone: the focus goes into the table, not back to the page.
  await expect.poll(() => table().element().contains(document.activeElement)).toBe(true);
  expect(column('Approche').elements()).toEqual([]);
  expect(
    table()
      .getByRole('columnheader')
      .elements()
      .map((header) => header.textContent),
  ).toEqual([
    'Contact',
    'Organisation',
    'Cible',
    'Étape',
    'Essai en cours',
    'Prochaine Relance',
    "Entrée dans l'Étape",
  ]);
  expect(tableNames()).toEqual([
    'Claire Martin',
    'Léa Petit',
    'Paul Durand',
    'Marc Roy',
    'Inès Haddad',
  ]);
  const claireRow = table().getByRole('row', { name: /Claire Martin/ });
  await expect.element(claireRow).toHaveTextContent('Capgemini');
  await expect.element(claireRow).toHaveTextContent('ESN');
  await expect.element(claireRow).toHaveTextContent('Approche');
  await expect.element(claireRow).toHaveTextContent('Relance 2 · en retard · 3 j');
  await expect.element(claireRow).toHaveTextContent('14 sept. 2026');
  await expect
    .element(table().getByRole('row', { name: /Paul Durand/ }))
    .toHaveTextContent('Essai « CV Rust » · délai dépassé');
  expect(localStorage.getItem(VIEW_KEY)).toBe('table');
  await expect.element(page.getByRole('radio', { name: 'Table' })).toBeChecked();

  await userEvent.keyboard('v');
  await expect.element(column('Approche')).toBeVisible();
  expect(localStorage.getItem(VIEW_KEY)).toBe('kanban');
  await expect.element(card('Claire Martin')).toHaveFocus();
});

test('the Funnel opens on the last view chosen on the device; a choice it cannot read gives the kanban', async () => {
  await desktop();
  localStorage.setItem(VIEW_KEY, 'table');
  const { screen } = await renderApp('/funnel', funnelApi());
  await expect.element(table()).toBeVisible();
  await screen.unmount();

  localStorage.setItem(VIEW_KEY, 'list-of-cards');
  const second = await renderApp('/funnel', funnelApi());
  await expect.element(column('Approche')).toBeVisible();
  await second.screen.unmount();

  // Storage refused (private mode, blocked site data): the kanban, and the choice lives on screen.
  const read = Storage.prototype.getItem.bind(localStorage);
  const write = Storage.prototype.setItem.bind(localStorage);
  const getItem = vi
    .spyOn(Storage.prototype, 'getItem')
    .mockImplementation((key) => (key === VIEW_KEY ? refuse() : read(key)));
  const setItem = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation((key, value) => (key === VIEW_KEY ? refuse() : write(key, value)));
  try {
    await renderApp('/funnel', funnelApi());
    await expect.element(column('Approche')).toBeVisible();
    await page.getByRole('radiogroup', { name: 'Vue' }).getByText('Table').click();
    await expect.element(table()).toBeVisible();
  } finally {
    getItem.mockRestore();
    setItem.mockRestore();
  }
});

test('V does nothing with “Single-key shortcuts” off', async () => {
  await desktop();
  const api = fakeApi({
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: TIME_ZONE,
          contacts: [marc()],
          stages: [OUTREACH],
          positionings: [CV],
          settings: { singleKeyShortcuts: false },
        }),
      ),
  });
  await renderApp('/funnel', api);
  await expect.element(column('Approche')).toBeVisible();
  await expect.element(page.getByRole('radiogroup', { name: 'Vue' })).toBeVisible();

  await userEvent.keyboard('v');

  await expect.element(column('Approche')).toBeVisible();
  expect(table().elements()).toEqual([]);
});

test('V typed in a field is a letter, not the shortcut', async () => {
  await desktop();
  await renderApp('/funnel', funnelApi());
  await expect.element(column('Approche')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Nom ou Organisation' }).click();
  await userEvent.keyboard('v');

  await expect
    .element(page.getByRole('searchbox', { name: 'Nom ou Organisation' }))
    .toHaveValue('v');
  expect(table().elements()).toEqual([]);
});

test('the table sorts by a column, both ways, then back by urgency', async () => {
  await desktop();
  localStorage.setItem(VIEW_KEY, 'table');
  await renderApp('/funnel', funnelApi());
  await expect.element(table()).toBeVisible();
  expect(page.getByRole('button', { name: 'Trier par urgence' }).elements()).toEqual([]);

  await table().getByRole('columnheader', { name: 'Contact' }).click();
  await expect
    .poll(tableNames)
    .toEqual(['Claire Martin', 'Inès Haddad', 'Léa Petit', 'Marc Roy', 'Paul Durand']);
  await table().getByRole('columnheader', { name: 'Contact' }).click();
  await expect
    .poll(tableNames)
    .toEqual(['Paul Durand', 'Marc Roy', 'Léa Petit', 'Inès Haddad', 'Claire Martin']);

  // By Stage, in the order of the Funnel; then by urgency within it.
  await table().getByRole('columnheader', { name: 'Étape', exact: true }).click();
  await expect
    .poll(tableNames)
    .toEqual(['Claire Martin', 'Léa Petit', 'Paul Durand', 'Marc Roy', 'Inès Haddad']);

  await table().getByRole('columnheader', { name: 'Prochaine Relance' }).click();
  await expect.poll(() => tableNames().slice(0, 2)).toEqual(['Claire Martin', 'Léa Petit']);

  await page.getByRole('button', { name: 'Trier par urgence' }).click();
  await expect
    .poll(tableNames)
    .toEqual(['Claire Martin', 'Léa Petit', 'Paul Durand', 'Marc Roy', 'Inès Haddad']);
});

test('in the table, the Stage changes in the row, through the window of consequences; the filters are those of the kanban', async () => {
  await desktop();
  localStorage.setItem(VIEW_KEY, 'table');
  const { router } = await renderApp('/funnel', funnelApi());

  await table().getByRole('button', { name: 'Étape de Marc Roy : Approche' }).click();
  await page.getByRole('menuitem', { name: 'Qualif ESN' }).click();
  const dialog = page.getByRole('dialog', { name: "Changer Marc Roy d'Étape" });
  await expect
    .element(dialog.getByRole('combobox', { name: 'Nouvelle Étape' }))
    .toHaveDisplayValue('Avancer à Qualif ESN');
  expect(router.state.location.search).toMatchObject({ stageTo: AGENCY.id });
  await userEvent.keyboard('{Escape}');

  await page.getByRole('searchbox', { name: 'Nom ou Organisation' }).fill('capgem');
  await expect.poll(tableNames).toEqual(['Claire Martin']);

  // The name opens the record beside the table.
  await page.getByRole('searchbox', { name: 'Nom ou Organisation' }).fill('');
  await table().getByRole('button', { name: 'Claire Martin', exact: true }).click();
  await expect
    .element(page.getByRole('heading', { name: 'Claire Martin', level: 2 }))
    .toHaveFocus();
});

test('the table passes axe in both themes', async () => {
  await desktop();
  localStorage.setItem(VIEW_KEY, 'table');
  await renderApp('/funnel', funnelApi());
  await expect.element(table()).toBeVisible();

  await expectNoAxeViolations();
  await commands.emulateColorScheme('dark');
  await expectNoAxeViolations();
});

// ——— Narrow width (spec UX §5.2) ———

test('on a phone, the Funnel is a list grouped by Stage, by urgency, without drag nor table; a Contact opens its record', async () => {
  await page.viewport(390, 844);
  // Even after the table was chosen on a wider screen.
  localStorage.setItem(VIEW_KEY, 'table');
  const { router } = await renderApp('/funnel', funnelApi());

  const outreach = page.getByRole('list', { name: 'Approche' });
  await expect.element(outreach).toBeVisible();
  expect(
    outreach
      .getByRole('listitem')
      .elements()
      .map((item) => item.querySelector('a')?.textContent),
  ).toEqual(['Claire Martin', 'Léa Petit', 'Paul Durand', 'Marc Roy']);
  await expect
    .element(page.getByRole('list', { name: 'Qualif ESN' }))
    .toHaveTextContent('Inès Haddad');
  await expect.element(outreach).toHaveTextContent('Relance 2 · en retard · 3 j');
  expect(page.getByRole('grid').elements()).toEqual([]);
  expect(page.getByRole('button', { name: /^Déplacer/ }).elements()).toEqual([]);
  expect(page.getByRole('radiogroup', { name: 'Vue' }).elements()).toEqual([]);

  await expectNoAxeViolations();
  await commands.emulateColorScheme('dark');
  await expectNoAxeViolations();

  await outreach.getByRole('link', { name: 'Claire Martin' }).click();
  await expect.poll(() => router.state.location.pathname).toBe(`/contacts/${CLAIRE_ID}`);
});
