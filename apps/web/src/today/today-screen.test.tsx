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
import type { SummaryContact, SummarySettings } from '../summary.ts';

const desktop = () => page.viewport(1400, 900);

const TIME_ZONE = 'Europe/Paris';
/** Today for the User, as the SPA reads it. */
const today = () => localDay(new Date(), TIME_ZONE);

const OUTREACH = stage({ id: '01990000-0000-7000-8000-000000000011', name: 'Approche' });
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
});
const CAPGEMINI = organization({ id: '01990000-0000-7000-8000-000000000031', name: 'Capgemini' });

const prospecting = (fields: Partial<SummaryContact>) =>
  contact({ status: 'prospecting', stageId: OUTREACH.id, ...fields });
/** An Ally last in touch some days ago. */
const ally = (fields: Partial<SummaryContact>, daysAgo: number) =>
  contact({
    status: 'ally',
    lastInteractionOn: addDays(today(), -daysAgo),
    lastDoneInteractionOn: addDays(today(), -daysAgo),
    ...fields,
  });

/** Claire: Follow-up 2 overdue by nine days, at Capgemini. */
const claire = () =>
  prospecting({
    id: '01990000-0000-7000-8000-000000000001',
    name: 'Claire Martin',
    organizationId: CAPGEMINI.id,
    followUp: { dueOn: addDays(today(), -9), note: null, rank: 2 },
  });
/** Inès: an Ally five days past the Rhythm of 28 days. */
const ines = () => ally({ id: '01990000-0000-7000-8000-000000000002', name: 'Inès Moreau' }, 33);
/** Tom: an Ally whose Follow-up is overdue by a day: a Follow-up to do. */
const tom = () =>
  ally(
    {
      id: '01990000-0000-7000-8000-000000000003',
      name: 'Tom Blanc',
      followUp: { dueOn: addDays(today(), -1), note: null, rank: null },
    },
    2,
  );
/** Léa: Follow-up 1 today. */
const lea = () =>
  prospecting({
    id: '01990000-0000-7000-8000-000000000004',
    name: 'Léa Petit',
    followUp: { dueOn: today(), note: null, rank: 1 },
  });
/** Paul: a Trial in progress past its Response window. */
const paul = () =>
  prospecting({
    id: '01990000-0000-7000-8000-000000000005',
    name: 'Paul Durand',
    trial: {
      battleId: BATTLE.id,
      positioningId: CV.id,
      startedOn: addDays(today(), -40),
      overridden: false,
    },
    lastDoneInteractionOn: addDays(today(), -20),
  });
/** Marc: nothing next. */
const marc = () => prospecting({ id: '01990000-0000-7000-8000-000000000006', name: 'Marc Roy' });
/** Sara: an Ally to check in with soon. */
const sara = () => ally({ id: '01990000-0000-7000-8000-000000000007', name: 'Sara Lopez' }, 24);
/** Nina: Follow-up 1 tomorrow. */
const nina = () =>
  prospecting({
    id: '01990000-0000-7000-8000-000000000008',
    name: 'Nina Roux',
    followUp: { dueOn: addDays(today(), 1), note: null, rank: 1 },
  });
/** Hugo: in the Pool. */
const hugo = () => contact({ id: '01990000-0000-7000-8000-000000000009', name: 'Hugo Blanc' });

const everyone = () => [claire(), ines(), tom(), lea(), paul(), marc(), sara(), nina(), hugo()];

type Routes = Parameters<typeof fakeApi>[0];

function todayApi({
  contacts = everyone(),
  settings = {},
  routes: extra = {},
}: { contacts?: SummaryContact[]; settings?: Partial<SummarySettings>; routes?: Routes } = {}) {
  const routes: Routes = {
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: TIME_ZONE,
          settings,
          contacts,
          stages: [OUTREACH],
          organizations: [CAPGEMINI],
          positionings: [CV, CALL],
          battles: [BATTLE],
        }),
      ),
  };
  for (const { id } of contacts) {
    routes[`GET /api/contacts/${id}/record`] = () => Response.json({ note: null, thread: [] });
  }
  return fakeApi({ ...routes, ...extra });
}

const section = (name: RegExp) => page.getByRole('region', { name });
const rowsOf = (name: RegExp) =>
  section(name)
    .getByRole('listitem')
    .elements()
    .map((row) => row.textContent);

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(async () => {
  await commands.emulateColorScheme('light');
});

test('the Follow-ups due and the Allies to check in with, in one list by how long overdue; then the Trials past their window', async () => {
  await desktop();
  await renderApp('/today', todayApi());

  const due = section(/^Relances et Alliés à relancer/);
  await expect.element(due).toBeVisible();
  expect(rowsOf(/^Relances et Alliés à relancer/)).toEqual([
    expect.stringContaining('Claire Martin'),
    expect.stringContaining('Inès Moreau'),
    expect.stringContaining('Tom Blanc'),
    expect.stringContaining('Léa Petit'),
  ]);
  const [claireRow, inesRow, tomRow, leaRow] = due.getByRole('listitem').all();
  await expect.element(claireRow!).toHaveTextContent('Capgemini · Approche');
  await expect.element(claireRow!).toHaveTextContent('Relance 2 · en retard · 9 j');
  await expect.element(claireRow!.getByRole('button', { name: 'Relancer…' })).toBeVisible();
  // An Ally is marked as one, and says how far past the Rhythm.
  await expect.element(inesRow!).toHaveTextContent('Allié');
  await expect.element(inesRow!).toHaveTextContent('Rythme dépassé (5 j) · 33 j sans contact');
  await expect
    .element(inesRow!.getByRole('button', { name: 'Prendre des nouvelles…' }))
    .toBeVisible();
  // An Ally whose Follow-up is due shows as a Follow-up.
  await expect.element(tomRow!).toHaveTextContent('Allié');
  await expect.element(tomRow!.getByRole('button', { name: 'Relancer…' })).toBeVisible();
  await expect.element(leaRow!).toHaveTextContent("Relance 1 · aujourd'hui");

  expect(rowsOf(/^Essais délai dépassé/)).toEqual([expect.stringContaining('Paul Durand')]);
  const paulRow = section(/^Essais délai dépassé/).getByRole('listitem');
  await expect.element(paulRow).toHaveTextContent('Essai « CV Rust » · délai dépassé');
  await expect.element(paulRow.getByRole('button', { name: 'Sans suite' })).toBeVisible();
  await expect.element(paulRow.getByRole('button', { name: 'Relancer quand même' })).toBeVisible();

  // Nothing calls for Marc, Sara, Nina or Hugo today.
  const main = page.getByRole('main').element().textContent;
  for (const name of ['Marc Roy', 'Sara Lopez', 'Hugo Blanc']) expect(main).not.toContain(name);
});

test('the amber count on Today: the number alone, its tooltip and label say what it counts; none on the Circle', async () => {
  await desktop();
  await renderApp('/funnel', todayApi());
  const menu = page.getByRole('navigation', { name: 'Menu principal' });

  const todayLink = menu.getByRole('link', { name: /^Aujourd'hui/ });
  await expect
    .element(todayLink)
    .toHaveAccessibleName("Aujourd'hui · 3 à traiter, 2 Alliés à relancer");
  const count = todayLink.element().querySelector('[data-nav-count]');
  expect(count?.textContent).toBe('5');
  expect(count?.getAttribute('title')).toBe('3 à traiter, 2 Alliés à relancer');
  await expect.element(menu.getByRole('link', { name: /^Cercle/ })).toHaveAccessibleName('Cercle');
});

test('the count says only what there is; none when nothing calls for a gesture', async () => {
  await desktop();
  await renderApp('/funnel', todayApi({ contacts: [ines(), marc()] }));
  const menu = page.getByRole('navigation', { name: 'Menu principal' });
  await expect
    .element(menu.getByRole('link', { name: /^Aujourd'hui/ }))
    .toHaveAccessibleName("Aujourd'hui · 1 Allié à relancer");
});

test('no count without anything to handle', async () => {
  await desktop();
  await renderApp('/funnel', todayApi({ contacts: [marc(), sara()] }));
  const menu = page.getByRole('navigation', { name: 'Menu principal' });
  await expect.element(menu.getByRole('link', { name: 'Funnel' })).toBeVisible();
  await expect
    .element(menu.getByRole('link', { name: /^Aujourd'hui/ }))
    .toHaveAccessibleName("Aujourd'hui");
});

test('beside the list: the Circle against its size goal, a link to its page, and the Follow-ups of tomorrow', async () => {
  await desktop();
  const { router } = await renderApp('/today', todayApi());

  const upcoming = section(/^À venir/);
  await expect.element(upcoming).toBeVisible();
  expect(rowsOf(/^À venir/)).toEqual(['Nina RouxRelance 1 demain']);
  const circle = page.getByRole('link', { name: 'Cercle : 3 Alliés sur 10 visés' });
  await expect.element(circle).toHaveTextContent('Cercle 3/10');
  await circle.click();
  await expect.poll(() => router.state.location.pathname).toBe('/circle');
});

test('without a size goal, the Circle says its count alone', async () => {
  await desktop();
  await renderApp('/today', todayApi({ settings: { circleSizeGoal: null } }));
  await expect.element(page.getByRole('link', { name: 'Cercle · 3 Alliés' })).toBeVisible();
});

test('each row opens its gesture in the same panel as anywhere else, and its name the record beside the list', async () => {
  await desktop();
  const { router } = await renderApp('/today', todayApi());
  const due = section(/^Relances et Alliés à relancer/);

  await due.getByRole('listitem').first().getByRole('button', { name: 'Relancer…' }).click();
  await expect.element(page.getByRole('dialog', { name: 'Relancer Claire Martin' })).toBeVisible();
  expect(router.state.location.search).toEqual({ contact: claire().id, followUp: 'do' });
  await userEvent.keyboard('{Escape}');

  await due.getByRole('button', { name: 'Prendre des nouvelles…' }).click();
  await expect
    .element(page.getByRole('dialog', { name: 'Prendre des nouvelles de Inès Moreau' }))
    .toBeVisible();
  await userEvent.keyboard('{Escape}');

  await section(/^Essais délai dépassé/)
    .getByRole('button', { name: 'Sans suite' })
    .click();
  expect(router.state.location.search).toEqual({ contact: paul().id, trial: 'no-result' });
  await userEvent.keyboard('{Escape}');

  await page.getByRole('link', { name: /^Léa Petit/ }).click();
  await expect.element(page.getByRole('region', { name: /^Léa Petit/ })).toBeVisible();
  await expect
    .element(page.getByRole('link', { name: /^Léa Petit/ }))
    .toHaveAttribute('aria-current', 'page');
  // Closed, the record gives the focus back to its row.
  await page
    .getByRole('region', { name: /^Léa Petit/ })
    .getByRole('button', { name: 'Fermer' })
    .click();
  await expect.element(page.getByRole('link', { name: /^Léa Petit/ })).toHaveFocus();
});

test('the first day: no Contact yet, the Stages the Funnel starts with, and Add a Contact', async () => {
  await desktop();
  await renderApp('/today', todayApi({ contacts: [] }));

  await expect.element(page.getByText("Aucun Contact pour l'instant.")).toBeVisible();
  await expect.element(page.getByRole('listitem').filter({ hasText: 'Approche' })).toBeVisible();
  await page.getByRole('button', { name: /^Ajouter un Contact/ }).click();
  await expect.element(page.getByRole('dialog', { name: 'Ajouter un Contact' })).toBeVisible();
});

test('nothing planned today: a message, tomorrow still shown beside it', async () => {
  await desktop();
  await renderApp('/today', todayApi({ contacts: [marc(), sara(), nina()] }));
  await expect.element(page.getByText("Rien à traiter aujourd'hui.")).toBeVisible();
  await expect.element(section(/^À venir/)).toHaveTextContent('Nina Roux');
  expect(document.querySelector('[data-nav-count]')).toBeNull();
});

test('Postpone from a row: the Follow-up moves to its new day and leaves the list, with “Undo”', async () => {
  await desktop();
  const moved = { ...claire(), followUp: { dueOn: addDays(today(), 3), note: null, rank: 2 } };
  const api = todayApi({
    contacts: [claire(), lea()],
    routes: {
      [`POST /api/contacts/${claire().id}/schedule-follow-up`]: () =>
        Response.json({
          changes: changes({ contacts: [moved] }),
          undoToken: '01990000-0000-7000-8000-00000000000a',
        }),
    },
  });
  await renderApp('/today', api);
  const due = section(/^Relances et Alliés à relancer/);
  await due.getByRole('listitem').first().getByRole('button', { name: 'Reporter' }).click();
  await page.getByRole('menuitem', { name: '+3 j' }).click();

  await expect.element(due).not.toHaveTextContent('Claire Martin');
  expect(api.sent(`POST /api/contacts/${claire().id}/schedule-follow-up`)).toEqual([
    { route: expect.any(String), body: { dueOn: addDays(today(), 3) } },
  ]);
  await expect.element(page.getByRole('button', { name: /^Annuler$/ })).toBeVisible();
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing on Today, in the %s theme',
  async (scheme) => {
    await commands.emulateColorScheme(scheme);
    await desktop();
    await renderApp('/today', todayApi());
    await expect.element(section(/^Essais délai dépassé/)).toBeVisible();
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');
    await expectNoAxeViolations();
  },
);
