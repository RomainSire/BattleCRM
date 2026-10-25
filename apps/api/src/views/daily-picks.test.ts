import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { closeBattle, openBattle } from '../../test/factories/battle.ts';
import { addContact, changeStatus, scheduleFollowUp } from '../../test/factories/contact.ts';
import { createPositioning, stageIdsOf } from '../../test/factories/positioning.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';

type Harness = ReturnType<typeof testApp>;

/** What Today reads of its picks of the day (spec UX §5.1, ST-47). */
const dailyPicks = z.strictObject({
  day: z.iso.date(),
  entries: z.array(z.uuid()),
  noNextStep: z.array(z.uuid()),
  postponedBattleIds: z.array(z.uuid()),
});

async function picksOf(harness: Harness, user: { cookie: string }) {
  const response = await harness.app.request('/api/today/picks', {
    headers: { Cookie: user.cookie },
  });
  expect(response.status).toBe(200);
  return dailyPicks.parse(await response.json());
}

/** Contacts added to the Pool, in that order. */
async function addToPool(harness: Harness, user: { cookie: string }, names: string[]) {
  const ids = [];
  for (const name of names) ids.push((await addContact(harness, user, name)).contact.id);
  return ids;
}

test('three Contacts of the Pool are picked at the first read of the day, the same all day, others the next day', async () => {
  // 23:30 in Paris, on Monday 5 January.
  const harness = testApp({}, { startsAt: '2026-01-05T22:30:00Z', chances: [1, 0, 1, 3, 0, 0] });
  const user = await makeUser(harness);
  const [anne, bruno, , david] = await addToPool(harness, user, [
    'Anne',
    'Bruno',
    'Chloé',
    'David',
  ]);

  const first = await picksOf(harness, user);
  harness.clock.advance('PT20M');
  const again = await picksOf(harness, user);
  // Past midnight in Paris.
  harness.clock.advance('PT20M');
  const tomorrow = await picksOf(harness, user);

  expect(first).toEqual({
    day: '2026-01-05',
    entries: [bruno, anne, david],
    noNextStep: [],
    postponedBattleIds: [],
  });
  expect(again).toEqual(first);
  expect(tomorrow).toEqual({
    day: '2026-01-06',
    entries: [david, anne, bruno],
    noNextStep: [],
    postponedBattleIds: [],
  });
});

test('a Contact picked that enters the Funnel is replaced by another of the Pool, as long as it has more', async () => {
  const harness = testApp({}, { chances: [0, 0, 0, 1] });
  const user = await makeUser(harness);
  const [anne, bruno, chloe, david, emma] = await addToPool(harness, user, [
    'Anne',
    'Bruno',
    'Chloé',
    'David',
    'Emma',
  ]);
  const [stageId = ''] = await stageIdsOf(harness, user);
  const enter = (contactId = '') =>
    changeStatus(harness, user, contactId, { status: 'prospecting', stageId });

  expect((await picksOf(harness, user)).entries).toEqual([anne, bruno, chloe]);
  await enter(bruno);
  expect((await picksOf(harness, user)).entries).toEqual([anne, chloe, emma]);
  await enter(anne);
  await enter(chloe);
  // The last one of the Pool: no chance needed.
  expect((await picksOf(harness, user)).entries).toEqual([emma, david]);
  await enter(emma);
  await enter(david);
  expect((await picksOf(harness, user)).entries).toEqual([]);
});

test('three Contacts with No next step are picked once a day: one handled stays picked, never replaced', async () => {
  const harness = testApp({}, { startsAt: '2026-01-05T09:00:00Z', chances: [3, 0, 0, 1, 0] });
  const user = await makeUser(harness);
  const [outreach = '', interview = ''] = await stageIdsOf(harness, user);
  await createPositioning(harness, user, outreach);
  const prospecting = async (name: string, stageId = outreach) =>
    (await addContact(harness, user, name, { status: 'prospecting', stageId })).contact.id;
  const anne = await prospecting('Anne');
  const bruno = await prospecting('Bruno');
  const chloe = await prospecting('Chloé');
  const david = await prospecting('David');
  // Waiting: a Follow-up scheduled, or a Stage without a Positioning.
  const emma = await prospecting('Emma');
  await scheduleFollowUp(harness, user, emma, { dueOn: '2026-01-09' });
  await prospecting('Farid', interview);

  expect((await picksOf(harness, user)).noNextStep).toEqual([david, anne, bruno]);
  await scheduleFollowUp(harness, user, anne, { dueOn: '2026-01-09' });
  expect((await picksOf(harness, user)).noNextStep).toEqual([david, anne, bruno]);
  harness.clock.advance('P1D');
  // Chloé and David are left with No next step, Anne no longer.
  expect((await picksOf(harness, user)).noNextStep).toEqual([chloe, bruno, david]);
});

const later = (harness: Harness, user: { cookie: string }, battleId: string) =>
  postJson(harness.app, `/api/today/battles/${battleId}/later`, {}, user.cookie);

test('“Later” hides a Battle from Today until the next day, on every device', async () => {
  // 23:30 in Paris.
  const harness = testApp({}, { startsAt: '2026-01-05T22:30:00Z' });
  const user = await makeUser(harness);
  const [stageId = ''] = await stageIdsOf(harness, user);
  const { positioning: champion } = await createPositioning(harness, user, stageId);
  const { positioning: challenger } = await createPositioning(harness, user, stageId, {
    label: 'Appel',
    channel: 'phone',
  });
  const { battle } = await openBattle(harness, user, {
    stageId: stageId,
    championId: champion.id,
    challengerId: challenger.id,
  });

  expect((await later(harness, user, battle.id)).status).toBe(204);
  expect((await later(harness, user, battle.id)).status).toBe(204);
  expect((await picksOf(harness, user)).postponedBattleIds).toEqual([battle.id]);
  harness.clock.advance('PT40M');
  expect((await picksOf(harness, user)).postponedBattleIds).toEqual([]);
});

test('“Later” is refused for a Battle closed, unknown or of another User', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const other = await makeUser(harness);
  const [stageId = ''] = await stageIdsOf(harness, user);
  const { positioning: champion } = await createPositioning(harness, user, stageId);
  const { positioning: challenger } = await createPositioning(harness, user, stageId, {
    label: 'Appel',
    channel: 'phone',
  });
  const { battle } = await openBattle(harness, user, {
    stageId: stageId,
    championId: champion.id,
    challengerId: challenger.id,
  });

  const refused = [
    await later(harness, other, battle.id),
    await later(harness, user, '01990000-0000-7000-8000-000000000000'),
    await later(harness, user, 'not-an-id'),
  ];
  await closeBattle(harness, user, battle.id);
  refused.push(await later(harness, user, battle.id));

  for (const response of refused) {
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  }
  expect((await picksOf(harness, user)).postponedBattleIds).toEqual([]);
});

const pass = (harness: Harness, user: { cookie: string }, contactId: string) =>
  postJson(harness.app, `/api/today/picks/entries/${contactId}/pass`, {}, user.cookie);

test('“Another one” puts a Contact picked behind one more of the Pool, on every device, then cycles', async () => {
  const harness = testApp({}, { startsAt: '2026-01-05T09:00:00Z', chances: [0, 0, 0, 0, 0, 0, 0] });
  const user = await makeUser(harness);
  const [anne = '', bruno = '', chloe = '', david = ''] = await addToPool(harness, user, [
    'Anne',
    'Bruno',
    'Chloé',
    'David',
  ]);

  expect((await picksOf(harness, user)).entries).toEqual([anne, bruno, chloe]);
  const passed = await pass(harness, user, anne);
  expect(passed.status).toBe(200);
  // One more of the Pool, what every device now reads.
  expect(dailyPicks.parse(await passed.json()).entries).toEqual([bruno, chloe, david]);
  expect((await picksOf(harness, user)).entries).toEqual([bruno, chloe, david]);
  // A device behind passes Anne again: nothing changes.
  const again = await pass(harness, user, anne);
  expect(again.status).toBe(200);
  expect(dailyPicks.parse(await again.json()).entries).toEqual([bruno, chloe, david]);
  // The Pool has no more: the one passed first comes back, last.
  await pass(harness, user, bruno);
  expect((await picksOf(harness, user)).entries).toEqual([chloe, david, anne]);
  await pass(harness, user, chloe);
  expect((await picksOf(harness, user)).entries).toEqual([david, anne, bruno]);
  // The next day, the picks start again.
  harness.clock.advance('P1D');
  expect((await picksOf(harness, user)).entries).toHaveLength(3);
});

test('“Another one” is refused for a Contact not picked today, or of another User', async () => {
  const harness = testApp({}, { chances: [0, 0, 0] });
  const user = await makeUser(harness);
  const other = await makeUser(harness);
  const [anne, , , david] = await addToPool(harness, user, ['Anne', 'Bruno', 'Chloé', 'David']);
  await picksOf(harness, user);

  const refused = [
    await pass(harness, other, anne ?? ''),
    await pass(harness, user, david ?? ''),
    await pass(harness, user, 'not-an-id'),
  ];
  for (const response of refused) {
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  }
});
