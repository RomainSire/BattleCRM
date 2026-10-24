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
import type { SummaryBattle, SummaryContact, SummarySettings } from '../summary.ts';

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

/** What Today picked for the day: none unless said otherwise. */
const picks = (fields: {
  entries?: string[];
  noNextStep?: string[];
  postponedBattleIds?: string[];
}) =>
  Response.json({ day: today(), entries: [], noNextStep: [], postponedBattleIds: [], ...fields });

function todayApi({
  contacts = everyone(),
  settings = {},
  battles = [BATTLE],
  celebratedOn = null,
  routes: extra = {},
}: {
  contacts?: SummaryContact[];
  settings?: Partial<SummarySettings>;
  battles?: SummaryBattle[];
  celebratedOn?: string | null;
  routes?: Routes;
} = {}) {
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
          battles,
          celebratedOn,
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

/** An Activity goal in effect today, and chosen for the next days. */
const activityGoal = (value: number | null) => ({
  activityGoal: { inEffect: value, chosen: value },
});
/** Two Prospecting actions today and one three days ago, on Claire. */
const busyClaire = () => ({
  ...claire(),
  prospectingActionDays: [addDays(today(), -3), today(), today()],
});
const activity = () => section(/^Activité du jour/);

test('beside the list: the Activity of the day against its goal, the last weeks by intensity across the column, and a link to Insights', async () => {
  await desktop();
  const { router } = await renderApp(
    '/today',
    todayApi({ contacts: [busyClaire(), lea()], settings: activityGoal(3) }),
  );

  await expect.element(activity()).toHaveTextContent('2/3');
  await expect.element(activity()).not.toHaveTextContent('Objectif atteint');
  // The gauge says it in words too (spec UX §7).
  await expect
    .element(activity().getByText("2 Actions de prospection sur 3 visées aujourd'hui"))
    .toBeInTheDocument();
  // Each day of the last 4 weeks, up to today, says its count: the intensity is never alone.
  // As many weeks as the column holds, the current one last, its days to come left out.
  const graph = activity().getByRole('list', { name: /^\d+ dernières semaines$/u });
  const weeks = Number(/\d+/u.exec(graph.element().getAttribute('aria-label') ?? '')?.[0]);
  expect(weeks).toBeGreaterThan(4);
  const days = graph
    .getByRole('listitem')
    .elements()
    .map((day) => day.textContent);
  expect(days.length).toBeGreaterThan(7 * (weeks - 1));
  expect(days.length).toBeLessThanOrEqual(7 * weeks);
  expect(days.filter((day) => day.endsWith(' : 1 Action'))).toHaveLength(1);
  expect(days.at(-1)).toMatch(/ : 2 Actions$/u);
  // The weeks fill the width of the card, within a square.
  const card = activity().element().getBoundingClientRect();
  const drawn = graph.element().getBoundingClientRect();
  expect(card.right - drawn.right).toBeLessThan(16);

  await activity().getByRole('link', { name: 'Indicateurs' }).click();
  await expect.poll(() => router.state.location.pathname).toBe('/insights');
});

test.each([320, 360, 390, 430])(
  'on a phone %dpx wide, the weeks fill the card without a horizontal scroll',
  async (width) => {
    await page.viewport(width, 800);
    await renderApp(
      '/today',
      todayApi({ contacts: [busyClaire(), lea()], settings: activityGoal(3) }),
    );
    const graph = activity().getByRole('list', { name: /dernières semaines$/u });
    await expect.element(graph).toBeVisible();
    await expect
      .poll(() => document.documentElement.scrollWidth)
      .toBeLessThanOrEqual(document.documentElement.clientWidth);
    const card = activity().element().getBoundingClientRect();
    const drawn = graph.element().getBoundingClientRect();
    expect(drawn.right).toBeLessThanOrEqual(card.right);
    expect(card.right - drawn.right).toBeLessThan(16);
  },
);

test('the weeks follow the width as it shrinks: a phone turned, a window narrowed', async () => {
  await page.viewport(700, 800);
  await renderApp(
    '/today',
    todayApi({ contacts: [busyClaire(), lea()], settings: activityGoal(3) }),
  );
  const graph = activity().getByRole('list', { name: /dernières semaines$/u });
  await expect.element(graph).toBeVisible();

  await page.viewport(360, 800);

  await expect
    .poll(() => document.documentElement.scrollWidth)
    .toBeLessThanOrEqual(document.documentElement.clientWidth);
  await expect
    .poll(
      () =>
        activity().element().getBoundingClientRect().right -
        graph.element().getBoundingClientRect().right,
    )
    .toBeGreaterThanOrEqual(0);
});

test('the Activity goal reached: the gauge says “reached”', async () => {
  await desktop();
  await renderApp('/today', todayApi({ contacts: [busyClaire()], settings: activityGoal(2) }));
  await expect.element(activity()).toHaveTextContent('2/2');
  await expect.element(activity()).toHaveTextContent('Objectif atteint');
});

test('without an Activity goal, the count of the day alone, no gauge', async () => {
  await desktop();
  await renderApp('/today', todayApi({ contacts: [busyClaire()], settings: activityGoal(null) }));
  await expect.element(activity()).toHaveTextContent("2 Actions aujourd'hui");
  await expect.element(activity()).not.toHaveTextContent('/');
  await expect.element(activity()).not.toHaveTextContent('Objectif');
});

/** Marc did two Prospecting actions today; Léa's Follow-up is due today. */
const twoDoneToday = () => [{ ...marc(), prospectingActionDays: [today(), today()] }, lea()];
const CELEBRATION_ROUTE = 'POST /api/today/celebration';

/** An API where “Follow up…” on Léa is one more Prospecting action today, and the celebration answers as said. */
function crossingApi({
  celebrate = true,
  settings = activityGoal(3),
  celebratedOn = null,
}: {
  celebrate?: boolean;
  settings?: Partial<SummarySettings>;
  celebratedOn?: string | null;
} = {}) {
  return todayApi({
    contacts: twoDoneToday(),
    settings,
    celebratedOn,
    routes: {
      [`POST /api/contacts/${lea().id}/follow-up`]: () =>
        Response.json({
          changes: changes({
            contacts: [{ ...lea(), followUp: null, prospectingActionDays: [today()] }],
          }),
          undoToken: '01990000-0000-7000-8000-00000000000a',
        }),
      [CELEBRATION_ROUTE]: () =>
        Response.json({ celebrate, celebratedOn: celebrate ? today() : celebratedOn }),
      // “Undo” gives Léa back as she was.
      'POST /api/gestures/01990000-0000-7000-8000-00000000000a/undo': () =>
        Response.json({ changes: changes({ contacts: [lea()] }) }),
    },
  });
}

/** “Follow up…” on Léa, from her row on Today, done today. */
async function followUpLea() {
  await section(/^Relances et Alliés à relancer/)
    .getByRole('button', { name: 'Relancer…' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Relancer Léa Petit' });
  await dialog.getByRole('button', { name: 'Relancer' }).click();
  await expect.element(page.getByText('Relance de Léa Petit notée · Activité 3/3')).toBeVisible();
}

const confetti = () => document.querySelectorAll('[data-confetti] > *').length;
const CELEBRATION = 'Bravo, objectif du jour atteint ! 3 / 3';

test('the gesture that reaches the Activity goal celebrates it once: confetti, the notification, the gauge “reached”', async () => {
  await desktop();
  const api = crossingApi();
  await renderApp('/today', api);
  await expect.element(activity()).toHaveTextContent('2/3');

  await followUpLea();

  await expect.element(page.getByText(CELEBRATION)).toBeVisible();
  expect(api.sent(CELEBRATION_ROUTE)).toHaveLength(1);
  // About forty, gone after about a second and a half (spec UX §2).
  await expect.poll(confetti).toBe(40);
  await expect.poll(confetti, { timeout: 3000 }).toBe(0);
  await expect.element(activity()).toHaveTextContent('Objectif atteint');

  // Undone, then done again the same day: never celebrated twice (ADR 0011).
  await page.getByRole('button', { name: /^Annuler$/ }).click();
  await expect.element(page.getByText('Annulé.')).toBeVisible();
  await expect.element(activity()).toHaveTextContent('2/3');
  await followUpLea();
  await expect.element(activity()).toHaveTextContent('Objectif atteint');
  expect(api.sent(CELEBRATION_ROUTE)).toHaveLength(1);
  expect(page.getByText(CELEBRATION).elements()).toHaveLength(1);
});

test('with reduced motion, the notification without confetti', async () => {
  await commands.emulateReducedMotion('reduce');
  await desktop();
  await renderApp('/today', crossingApi());

  await followUpLea();

  await expect.element(page.getByText(CELEBRATION)).toBeVisible();
  expect(confetti()).toBe(0);
});

test('celebrated already today on another device: nothing, the gauge still says “reached”', async () => {
  await desktop();
  const api = crossingApi({ celebrate: false, celebratedOn: addDays(today(), -1) });
  await renderApp('/today', api);

  await followUpLea();

  await expect.poll(() => api.sent(CELEBRATION_ROUTE)).toHaveLength(1);
  await expect.element(activity()).toHaveTextContent('Objectif atteint');
  await expect.element(page.getByText(CELEBRATION)).not.toBeInTheDocument();
  expect(confetti()).toBe(0);
});

test('nothing asked when the summary says today was celebrated already', async () => {
  await desktop();
  const api = crossingApi({ celebratedOn: today() });
  await renderApp('/today', api);

  await followUpLea();

  expect(api.sent(CELEBRATION_ROUTE)).toEqual([]);
  await expect.element(page.getByText(CELEBRATION)).not.toBeInTheDocument();
  expect(confetti()).toBe(0);
});

test('nothing asked with the celebration turned off (ST-53)', async () => {
  await desktop();
  const api = crossingApi({ settings: { ...activityGoal(3), celebrateGoal: false } });
  await renderApp('/today', api);

  await followUpLea();

  expect(api.sent(CELEBRATION_ROUTE)).toEqual([]);
  await expect.element(page.getByText(CELEBRATION)).not.toBeInTheDocument();
  expect(confetti()).toBe(0);
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

/** Zoé: in the Pool, back from Approche, at Capgemini. */
const zoe = () =>
  contact({
    id: '01990000-0000-7000-8000-00000000000b',
    name: 'Zoé Garnier',
    organizationId: CAPGEMINI.id,
    stageId: OUTREACH.id,
    funnelEntryDays: ['2025-11-03'],
  });
/** Yann: in the Pool, never entered. */
const yann = () => contact({ id: '01990000-0000-7000-8000-00000000000c', name: 'Yann Morel' });
/** Two Funnel entries this week, one last week. */
const enteredThisWeek = () => [
  { ...claire(), funnelEntryDays: [addDays(today(), -14), today()] },
  { ...lea(), funnelEntryDays: [today()] },
];
/** An Entry goal in effect this week, and chosen for the next ones. */
const goal = (value: number | null) => ({ inEffect: value, chosen: value });
const banner = () => page.getByRole('region', { name: /^Entrées/ });

test('the Entries banner: the entries of the week against the Entry goal, and Contacts of the Pool picked for the day', async () => {
  await desktop();
  const { router } = await renderApp(
    '/today',
    todayApi({
      contacts: [...enteredThisWeek(), hugo(), zoe(), yann()],
      routes: { 'GET /api/today/picks': () => picks({ entries: [zoe().id, hugo().id] }) },
    }),
  );

  await expect.element(banner()).toHaveTextContent('Entrées cette semaine 2/5');
  // The picks are read apart from the summary.
  await expect.element(banner()).toHaveTextContent('Hugo Blanc');
  expect(
    banner()
      .getByRole('listitem')
      .elements()
      .map((row) => row.textContent),
  ).toEqual([expect.stringContaining('Zoé Garnier'), expect.stringContaining('Hugo Blanc')]);
  const [zoeRow, hugoRow] = banner().getByRole('listitem').all();
  await expect.element(zoeRow!).toHaveTextContent('Capgemini · dernière Étape : Approche');
  await expect.element(hugoRow!).toHaveTextContent('Sans Organisation · jamais entré');
  // Yann was not picked today.
  await expect.element(banner()).not.toHaveTextContent('Yann Morel');

  await zoeRow!.getByRole('button', { name: 'Faire entrer…' }).click();
  expect(router.state.location.search).toEqual({ contact: zoe().id, statusTo: 'prospecting' });
  await expect.element(page.getByRole('dialog', { name: /Zoé Garnier/ })).toBeVisible();
});

test('the Entry goal reached shows in the success colour', async () => {
  await desktop();
  await renderApp(
    '/today',
    todayApi({ contacts: [...enteredThisWeek(), hugo()], settings: { entryGoal: goal(2) } }),
  );
  const count = banner().getByText('2/2');
  await expect.element(count).toBeVisible();
  expect(count.element().closest('.text-success')).not.toBeNull();
});

test('past the Entry goal, “3/2”', async () => {
  await desktop();
  await renderApp(
    '/today',
    todayApi({
      contacts: [...enteredThisWeek(), { ...hugo(), funnelEntryDays: [today()] }],
      settings: { entryGoal: goal(2) },
    }),
  );
  await expect.element(banner()).toHaveTextContent('Entrées cette semaine 3/2');
});

test('without an Entry goal, the count alone, without colour', async () => {
  await desktop();
  await renderApp(
    '/today',
    todayApi({ contacts: [...enteredThisWeek(), hugo()], settings: { entryGoal: goal(null) } }),
  );
  await expect.element(banner()).toHaveTextContent('Entrées 2 cette semaine');
  expect(banner().element().querySelector('.text-success')).toBeNull();
});

test('a Contact picked that enters the Funnel leaves the banner, and the one picked to replace it shows', async () => {
  await desktop();
  const entered = { ...hugo(), status: 'prospecting' as const, stageId: OUTREACH.id };
  let pickedEntries = [hugo().id, zoe().id];
  const api = todayApi({
    contacts: [hugo(), zoe(), yann()],
    routes: {
      'GET /api/today/picks': () => picks({ entries: pickedEntries }),
      [`POST /api/contacts/${hugo().id}/change-status`]: () => {
        pickedEntries = [zoe().id, yann().id];
        return Response.json({
          changes: changes({ contacts: [entered] }),
          undoToken: '01990000-0000-7000-8000-00000000000a',
        });
      },
    },
  });
  await renderApp('/today', api);
  await banner().getByRole('button', { name: 'Faire entrer…' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Faire entrer Hugo Blanc' });
  await dialog.getByRole('combobox', { name: 'Étape' }).selectOptions(OUTREACH.id);
  await dialog.getByRole('button', { name: 'Faire entrer' }).click();

  await expect.element(banner()).toHaveTextContent('Yann Morel');
  await expect.element(banner()).not.toHaveTextContent('Hugo Blanc');
  expect(api.sent('GET /api/today/picks').length).toBeGreaterThanOrEqual(2);
});

test('an empty Pool: the banner keeps its count, with Add a Contact in place of the picks', async () => {
  await desktop();
  await renderApp('/today', todayApi({ contacts: enteredThisWeek() }));
  await expect.element(banner()).toHaveTextContent('Entrées cette semaine 2/5');
  await banner()
    .getByRole('button', { name: /^Ajouter un Contact/ })
    .click();
  await expect.element(page.getByRole('dialog', { name: 'Ajouter un Contact' })).toBeVisible();
});

test('the Contacts with No next step picked for the day, a handled one gone without replacement; nothing planned still shows them', async () => {
  await desktop();
  const ugo = prospecting({ id: '01990000-0000-7000-8000-00000000000d', name: 'Ugo Vidal' });
  const { router } = await renderApp(
    '/today',
    todayApi({
      contacts: [marc(), ugo, nina(), sara()],
      // Nina was picked, then got a Follow-up.
      routes: {
        'GET /api/today/picks': () => picks({ noNextStep: [ugo.id, nina().id, marc().id] }),
      },
    }),
  );

  await expect.element(page.getByText("Rien à traiter aujourd'hui.")).toBeVisible();
  const list = section(/^Sans prochaine action/);
  await expect.element(list).toBeVisible();
  expect(rowsOf(/^Sans prochaine action/)).toEqual([
    expect.stringContaining('Ugo Vidal'),
    expect.stringContaining('Marc Roy'),
  ]);
  await list
    .getByRole('listitem')
    .first()
    .getByRole('button', { name: 'Utiliser un Positionnement' })
    .click();
  expect(router.state.location.search).toEqual({ contact: ugo.id, send: 'positioning' });
  await userEvent.keyboard('{Escape}');
  await expect
    .element(
      list.getByRole('listitem').first().getByRole('button', { name: 'Planifier une Relance' }),
    )
    .toBeVisible();
});

const side = (successes: number, noResults: number, inProgress = 0) => ({
  successes,
  noResults,
  inProgress,
});
/** Approche: Appel leads CV Rust 5/20 to 2/20: conclusive. */
const CONCLUSIVE = { ...BATTLE, trials: { champion: side(2, 18, 1), challenger: side(5, 15, 1) } };

test('a conclusive Battle beside the list: Close… opens its closing, Later hides it until tomorrow', async () => {
  await desktop();
  let postponedBattleIds: string[] = [];
  const api = todayApi({
    contacts: [marc()],
    battles: [CONCLUSIVE],
    routes: {
      'GET /api/today/picks': () => picks({ postponedBattleIds }),
      [`POST /api/today/battles/${BATTLE.id}/later`]: () => {
        postponedBattleIds = [BATTLE.id];
        return new Response(null, { status: 204 });
      },
    },
  });
  const { router } = await renderApp('/today', api);

  const conclusive = section(/^Battles concluantes/);
  await expect.element(conclusive).toHaveTextContent('Approche');
  await expect.element(conclusive).toHaveTextContent('La Battle est concluante.');
  await conclusive.getByRole('button', { name: 'Clôturer…' }).click();
  expect(router.state.location.search).toEqual({ battle: BATTLE.id });
  await expect
    .element(page.getByRole('dialog', { name: 'Clôturer la Battle · Approche' }))
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.poll(() => router.state.location.search).toEqual({});

  await conclusive.getByRole('button', { name: 'Plus tard' }).click();
  await expect
    .element(page.getByRole('region', { name: /^Battles concluantes/ }))
    .not.toBeInTheDocument();
  expect(api.sent(`POST /api/today/battles/${BATTLE.id}/later`)).toHaveLength(1);
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing on the picks of the day and the conclusive Battles, in the %s theme',
  async (scheme) => {
    await commands.emulateColorScheme(scheme);
    await desktop();
    await renderApp(
      '/today',
      todayApi({
        contacts: [...enteredThisWeek(), hugo(), zoe(), marc()],
        settings: { entryGoal: goal(2) },
        battles: [CONCLUSIVE],
        routes: {
          'GET /api/today/picks': () =>
            picks({ entries: [hugo().id, zoe().id], noNextStep: [marc().id] }),
        },
      }),
    );
    await expect.element(section(/^Battles concluantes/)).toBeVisible();
    await expect.element(section(/^Sans prochaine action/)).toBeVisible();
    await expect.element(banner()).toHaveTextContent('Hugo Blanc');
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');
    await expectNoAxeViolations();
  },
);
