import type { Insights } from '@battlecrm/contract';
import { addDays, localDay } from '@battlecrm/domain';
import { afterEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import { contact, stage, summary } from '../../test/summary.ts';

const TIME_ZONE = 'Europe/Paris';
const today = () => localDay(new Date(), TIME_ZONE);

const APPROCHE = stage({ id: '01990000-0000-7000-8000-0000000000a1', name: 'Approche' });
const ESN = stage({ id: '01990000-0000-7000-8000-0000000000a2', name: 'Qualif ESN' });
const CLOSING = stage({ id: '01990000-0000-7000-8000-0000000000a3', name: 'Closing' });
const RELANCE = stage({
  id: '01990000-0000-7000-8000-0000000000a4',
  name: 'Relance',
  archived: true,
});

/** Some Actions over the 12 months up to Wednesday 7 January 2026; 3 a day from 1 January. */
const ACTIONS: Record<string, number> = { '2025-06-02': 4, '2026-01-05': 2, '2026-01-07': 1 };

const INSIGHTS: Insights = {
  period: { from: '2025-01-08', to: '2026-01-07' },
  prospecting: { actionsThisWeek: 3, actionsLastWeek: 4, actionsInPeriod: 30, finishedTrials: 2 },
  activity: Array.from({ length: 365 }, (_, index) => {
    const day = addDays('2025-01-08', index);
    return { day, count: ACTIONS[day] ?? 0, goal: day >= '2026-01-01' ? 3 : 1 };
  }),
  funnel: {
    stages: [
      { stageId: APPROCHE.id, arrived: 4, passed: 1 },
      { stageId: ESN.id, arrived: 2, passed: 1 },
      { stageId: CLOSING.id, arrived: 3, passed: 0 },
      { stageId: RELANCE.id, arrived: 1, passed: null },
    ],
    exits: [
      { stageId: APPROCHE.id, ally: 0, pool: 1, archived: 1 },
      { stageId: CLOSING.id, ally: 1, pool: 0, archived: 0 },
      { stageId: RELANCE.id, ally: 0, pool: 1, archived: 0 },
    ],
    entryWeeks: [
      { monday: '2025-12-01', count: 0, goal: 5 },
      { monday: '2025-12-08', count: 1, goal: 5 },
      { monday: '2025-12-15', count: 2, goal: 5 },
      { monday: '2025-12-22', count: 3, goal: 5 },
      { monday: '2025-12-29', count: 6, goal: 5 },
      { monday: '2026-01-05', count: 2, goal: 3 },
    ],
  },
};

/** An API that answers Insights and keeps the periods asked for. */
function insightsApi() {
  const api = fakeApi({
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: TIME_ZONE,
          stages: [APPROCHE, ESN, CLOSING, RELANCE],
          contacts: [
            contact({ id: '01990000-0000-7000-8000-000000000001', status: 'ally' }),
            contact({
              id: '01990000-0000-7000-8000-000000000002',
              status: 'prospecting',
              stageId: APPROCHE.id,
              funnelEntryDays: [today()],
            }),
          ],
        }),
      ),
    'GET /api/insights': () => Response.json(INSIGHTS),
  });
  const periods: (string | null)[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    const url = new URL(new Request(input, init).url);
    if (url.pathname === '/api/insights') periods.push(url.searchParams.get('period'));
    return api.fetch(input, init);
  };
  return { ...api, fetch, periods };
}

const section = (name: string) => page.getByRole('region', { name });
const rowsOf = (table: ReturnType<typeof page.getByRole>) =>
  table
    .getByRole('row')
    .elements()
    .map((row) =>
      // A number keeps its unit on the line: “25 %” holds a narrow no-break space.
      [...row.querySelectorAll('th, td')].map((cell) =>
        (cell.textContent ?? '').replaceAll(/[\u00a0\u202f]/g, ' ').trim(),
      ),
    );

afterEach(async () => {
  await commands.emulateColorScheme('light');
});

test('the figures of the effort head Insights over 12 months by default, without any rate; another period is read again', async () => {
  await page.viewport(1280, 800);
  const api = insightsApi();
  await renderApp('/insights', api);

  const effort = section('Effort');
  await expect.element(effort).toHaveTextContent('Actions de prospection cette semaine3');
  await expect.element(effort).toHaveTextContent('4 la semaine dernière');
  await expect.element(effort).toHaveTextContent('Actions sur la période30');
  await expect.element(effort).toHaveTextContent('0,1 par jour');
  await expect.element(effort).toHaveTextContent('Essais terminés sur la période2');
  await expect.element(effort).toHaveTextContent('1 Entrées dans le Funnel sur 5 visées');
  await expect.element(effort).toHaveTextContent('1 Alliés sur 10 visés');
  expect(effort.element().textContent).not.toContain('%');
  expect(api.periods).toEqual(['12m']);

  await page.getByText('30 jours').click();
  await expect.poll(() => api.periods).toEqual(['12m', '30d']);
});

test('the Activity of each day, its goal of the day on hover or focus, the weeks in bars, and as a table', async () => {
  await page.viewport(1280, 800);
  await renderApp('/insights', insightsApi());

  const activity = section('Activité');
  await expect.element(activity).toHaveTextContent('7 actions sur 12 mois');
  const caption = activity.getByTestId('activity-caption');

  await activity
    .getByRole('button', { name: 'lun. 2 juin 2025 · 4 Actions · objectif du jour : 1' })
    .hover();
  await expect
    .element(caption)
    .toHaveTextContent('lun. 2 juin 2025 · 4 Actions · objectif du jour : 1');

  // The keyboard reaches the days from today, one step up a day before.
  const days = activity.getByRole('list', { name: 'Activité par jour, 12 derniers mois' });
  await days
    .getByRole('button', { name: 'mer. 7 janv. 2026 · 1 Action · objectif du jour : 3' })
    .click();
  await userEvent.keyboard('{ArrowUp}{ArrowUp}');
  await expect
    .element(caption)
    .toHaveTextContent('lun. 5 janv. 2026 · 2 Actions · objectif du jour : 3');
  // Left: the week before.
  await userEvent.keyboard('{ArrowLeft}');
  await expect
    .element(caption)
    .toHaveTextContent('lun. 29 déc. 2025 · 0 Action · objectif du jour : 1');

  await expect
    .element(activity.getByText('Semaine du 5 janv. 2026 · 3 Actions (en cours)'))
    .toBeInTheDocument();

  await activity.getByRole('button', { name: 'Voir en tableau' }).click();
  const table = activity.getByRole('table');
  await expect.element(table).toBeVisible();
  const rows = rowsOf(table);
  expect(rows[0]).toEqual(['Semaine du', 'L', 'M', 'M', 'J', 'V', 'S', 'D', 'Total']);
  expect(rows.at(-1)).toEqual(['5 janv. 2026', '2', '0', '1', '', '', '', '', '3']);
  await expect.element(days).not.toBeInTheDocument();
  await activity.getByRole('button', { name: 'Voir en graphe' }).click();
  await expect.element(days).toBeVisible();
});

test('the Funnel as a table: passages and Pass-through rates, archived Stages on demand, exits, entries by week', async () => {
  await page.viewport(1280, 800);
  await renderApp('/insights', insightsApi());

  const funnel = section('Funnel');
  const passages = funnel.getByRole('table', { name: 'Funnel' });
  await expect.element(passages).toBeVisible();
  expect(rowsOf(passages)).toEqual([
    ['Étape', 'Passages', 'Taux de passage'],
    ['Approche', '4', '25 %'],
    ['Qualif ESN', '2', '50 %'],
    ['Closing', '3', '0 %'],
  ]);
  const exits = funnel.getByRole('table', { name: 'Sorties par État et par Étape' });
  expect(rowsOf(exits)).toEqual([
    ['Étape', 'Vers Allié', 'Vers Vivier', 'Vers Archivé'],
    ['Approche', '0', '1', '1'],
    ['Closing', '1', '0', '0'],
  ]);

  await funnel.getByText('Afficher les Étapes archivées').click();
  await expect
    .poll(() => rowsOf(passages).at(-1))
    .toEqual(['Relance (archivée)', '1', '—aucun Taux de passage']);
  expect(rowsOf(exits).at(-1)).toEqual(['Relance (archivée)', '0', '1', '0']);

  const entries = funnel.getByRole('region', { name: 'Entrées dans le Funnel par semaine' });
  // The weeks over, without the current one.
  await expect.element(entries).toHaveTextContent('2,4 en moyenne par semaine');
  await entries
    .getByRole('button', { name: 'Semaine du 29 déc. 2025 · 6 entrées · objectif : 5' })
    .hover();
  await expect
    .element(entries.getByTestId('entries-caption'))
    .toHaveTextContent('Semaine du 29 déc. 2025 · 6 entrées · objectif : 5');
});

test.each([
  ['light', 'desktop', 1280],
  ['dark', 'phone', 390],
] as const)(
  'axe finds nothing on Insights in the %s theme, on a %s, and the page never scrolls sideways',
  async (scheme, _width, width) => {
    await page.viewport(width, 800);
    await commands.emulateColorScheme(scheme);
    await renderApp('/insights', insightsApi());
    await expect.element(section('Funnel').getByRole('table', { name: 'Funnel' })).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    await expectNoAxeViolations();
  },
);
