import { insights, type InsightsPeriod } from '@battlecrm/contract';
import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { openBattle, playTrials } from '../../test/factories/battle.ts';
import {
  addContact,
  changeStage,
  changeStatus,
  followUp,
  scheduleFollowUp,
} from '../../test/factories/contact.ts';
import { createPositioning, stageIdsOf } from '../../test/factories/positioning.ts';
import { archiveStage, createStage, stageGesture } from '../../test/factories/stage.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

async function insightsOf(harness: Harness, user: User, period: InsightsPeriod = '12m') {
  const response = await harness.app.request(`/api/insights?period=${period}`, {
    headers: { Cookie: user.cookie },
  });
  expect(response.status).toBe(200);
  return insights.parse(await response.json());
}

/** A Prospecting action on a local day: a Follow-up of a Contact, done. */
async function prospectingAction(harness: Harness, user: User, occurredOn: string) {
  const { contact } = await addContact(harness, user, 'Jean Dupont', { status: 'prospecting' });
  await scheduleFollowUp(harness, user, contact.id, { dueOn: '2027-01-04' });
  await followUp(harness, user, contact.id, { occurredOn });
}

test('the Activity of each day of the last 12 months, with the Activity goal in effect that day', async () => {
  // Wednesday 7 January 2026, in Paris.
  const harness = testApp({}, { startsAt: '2026-01-07T09:00:00Z' });
  const user = await makeUser(harness);
  await prospectingAction(harness, user, '2026-01-05');
  await prospectingAction(harness, user, '2026-01-05');
  await prospectingAction(harness, user, '2026-01-07');
  await prospectingAction(harness, user, '2025-01-07');
  // From tomorrow on, 3 a day.
  await postJson(harness.app, '/api/settings', { activityGoal: 3 }, user.cookie);
  harness.clock.advance('P1D');
  await prospectingAction(harness, user, '2026-01-08');

  const { period, activity } = await insightsOf(harness, user);

  expect(period).toEqual({ from: '2025-01-09', to: '2026-01-08' });
  expect(activity).toHaveLength(365);
  expect(activity[0]).toEqual({ day: '2025-01-09', count: 0, goal: 1 });
  expect(activity.slice(-4)).toEqual([
    { day: '2026-01-05', count: 2, goal: 1 },
    { day: '2026-01-06', count: 0, goal: 1 },
    { day: '2026-01-07', count: 1, goal: 1 },
    { day: '2026-01-08', count: 1, goal: 3 },
  ]);
});

test('a period is refused unless it is one of Insights', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const response = await harness.app.request('/api/insights?period=1w', {
    headers: { Cookie: user.cookie },
  });
  expect(response.status).toBe(400);
  expect(await harness.app.request('/api/insights?period=12m')).toHaveProperty('status', 401);
});

test('the Prospecting actions of the week, of the one before and of the period, the Trials finished, each Trial on the day it was settled, though the time zone changed since', async () => {
  // 00:30 on Tuesday 6 January in Paris, still Monday 5 in New York.
  const harness = testApp({}, { startsAt: '2026-01-05T23:30:00Z', chances: [0] });
  const user = await makeUser(harness);
  const [approche = ''] = await stageIdsOf(harness, user);
  const { positioning: cvA } = await createPositioning(harness, user, approche, { label: 'CV A' });
  const { positioning: cvB } = await createPositioning(harness, user, approche, { label: 'CV B' });
  await openBattle(harness, user, { stageId: approche, championId: cvA.id, challengerId: cvB.id });
  // Sent on 5 January, settled at once: on 6 January, in Paris.
  await playTrials(harness, user, cvA.id, { noResults: 1, inProgress: 1 });
  await postJson(harness.app, '/api/settings', { timeZone: 'America/New_York' }, user.cookie);
  // Wednesday 4 February, 18:30 in New York: the last 30 days start on 6 January.
  harness.clock.advance('P30D');
  for (const day of ['2026-02-04', '2026-02-02', '2026-01-30', '2026-01-30', '2026-01-06']) {
    await prospectingAction(harness, user, day);
  }

  const { period, prospecting } = await insightsOf(harness, user, '30d');

  expect(period).toEqual({ from: '2026-01-06', to: '2026-02-04' });
  // The two uses of CV A, on 5 January, are before the period.
  expect(prospecting).toEqual({
    actionsThisWeek: 2,
    actionsLastWeek: 2,
    actionsInPeriod: 5,
    finishedTrials: 1,
  });
});

test('the Funnel entries of each week, on the day they were written down though the time zone changed since, with the Entry goal of the week', async () => {
  // 23:30 on Wednesday 7 January in Paris.
  const harness = testApp({}, { startsAt: '2026-01-07T22:30:00Z' });
  const user = await makeUser(harness);
  const settings = (body: object) => postJson(harness.app, '/api/settings', body, user.cookie);
  await addContact(harness, user, 'Jean Dupont', { status: 'prospecting' });
  await addContact(harness, user, 'Paul Martin');
  // From next Monday on, 3 a week.
  await settings({ entryGoal: 3 });
  await settings({ timeZone: 'America/New_York' });
  // 22:30 on Sunday 11 January in New York, already Monday 12 in Paris.
  harness.clock.advance('P4DT5H');
  await addContact(harness, user, 'Claire Petit', { status: 'prospecting' });
  harness.clock.advance('P1D');
  await addContact(harness, user, 'Marc Leroy', { status: 'prospecting' });

  const { period, funnel } = await insightsOf(harness, user, '30d');

  expect(period).toEqual({ from: '2025-12-14', to: '2026-01-12' });
  expect(funnel.entryWeeks).toEqual([
    { monday: '2025-12-08', count: 0, goal: 5 },
    { monday: '2025-12-15', count: 0, goal: 5 },
    { monday: '2025-12-22', count: 0, goal: 5 },
    { monday: '2025-12-29', count: 0, goal: 5 },
    { monday: '2026-01-05', count: 2, goal: 5 },
    { monday: '2026-01-12', count: 1, goal: 3 },
  ]);
});

test('the Contacts that arrived at each Stage and went further, in the order of then, a skip passing the Stage left, and where Contacts left the Funnel', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const [approche = '', esn = '', client = '', closing = ''] = await stageIdsOf(harness, user);
  const prospect = async (name: string, stageId: string) =>
    (await addContact(harness, user, name, { status: 'prospecting', stageId })).contact.id;
  const move = (contactId: string, stageId: string) =>
    changeStage(harness, user, contactId, { stageId });

  // Forward, then on to Closing, past Qualif Client: a skip, which passes Qualif ESN only.
  const jean = await prospect('Jean Dupont', approche);
  await move(jean, esn);
  await move(jean, closing);
  await changeStatus(harness, user, jean, { status: 'ally' });
  // Entered at Qualif ESN, which leaves Approche out, then back to Approche.
  const paul = await prospect('Paul Martin', esn);
  await move(paul, approche);
  await changeStatus(harness, user, paul, { status: 'archived' });
  const claire = await prospect('Claire Petit', approche);
  await changeStatus(harness, user, claire, { status: 'pool' });
  // Forward when it happened, though Closing now comes before Qualif Client.
  await move(await prospect('Marc Leroy', client), closing);
  await stageGesture(harness, user, `/api/stages/${closing}/move`, { afterId: esn });
  await move(await prospect('Léa Roux', client), closing);
  // A Stage archived since: its passages, no rate.
  const { stages } = await createStage(harness, user, { name: 'Relance' });
  const relance = stages.at(-1)?.id ?? '';
  await move(await prospect('Hugo Blanc', relance), approche);
  await archiveStage(user, relance, harness.clock.now());

  const { funnel } = await insightsOf(harness, user, '30d');

  expect(funnel.stages).toEqual([
    { stageId: approche, arrived: 4, passed: 1 },
    { stageId: esn, arrived: 2, passed: 1 },
    { stageId: closing, arrived: 3, passed: 0 },
    { stageId: client, arrived: 2, passed: 1 },
    { stageId: relance, arrived: 1, passed: null },
  ]);
  expect(funnel.exits).toEqual([
    { stageId: approche, ally: 0, pool: 1, archived: 1 },
    { stageId: closing, ally: 1, pool: 0, archived: 0 },
  ]);
});

test('only what happened in the period counts', async () => {
  const harness = testApp({}, { startsAt: '2026-01-05T09:00:00Z' });
  const user = await makeUser(harness);
  const [approche = '', esn = ''] = await stageIdsOf(harness, user);
  const { contact } = await addContact(harness, user, 'Jean Dupont', { status: 'prospecting' });
  await changeStage(harness, user, contact.id, { stageId: esn });
  harness.clock.advance('P40D');
  await changeStatus(harness, user, contact.id, { status: 'pool' });

  const { funnel } = await insightsOf(harness, user, '30d');

  expect(funnel.stages.slice(0, 2)).toEqual([
    { stageId: approche, arrived: 0, passed: 0 },
    { stageId: esn, arrived: 0, passed: 0 },
  ]);
  expect(funnel.exits).toEqual([{ stageId: esn, ally: 0, pool: 1, archived: 0 }]);
  expect((await insightsOf(harness, user, 'all')).funnel.stages.slice(0, 2)).toEqual([
    { stageId: approche, arrived: 1, passed: 1 },
    { stageId: esn, arrived: 1, passed: 0 },
  ]);
});
