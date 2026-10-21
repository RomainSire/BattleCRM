import { expect, test } from 'vitest';

import { funnelOf, isInFunnel, nextStageOf, stageMove, stageToEnter } from './funnel.ts';

const stages = [
  { id: 'approach', archived: false },
  { id: 'old', archived: true },
  { id: 'closing', archived: false },
];
const funnel = funnelOf(stages);

test('the Funnel leaves its archived Stages out, in their order', () => {
  expect(funnel.map(({ id }) => id)).toEqual(['approach', 'closing']);
});

test('a Stage is in the Funnel until it is archived', () => {
  expect(isInFunnel(funnel, 'closing')).toBe(true);
  expect(isInFunnel(funnel, 'old')).toBe(false);
  expect(isInFunnel(funnel, 'unknown')).toBe(false);
  expect(isInFunnel(funnel, null)).toBe(false);
  expect(isInFunnel(funnel, undefined)).toBe(false);
});

test('a Contact enters the Funnel at the Stage chosen, or else at the last one it reached', () => {
  expect(stageToEnter(funnel, { chosen: 'approach', last: 'closing' })).toBe('approach');
  expect(stageToEnter(funnel, { last: 'closing' })).toBe('closing');
});

test('never at an archived Stage, nor without one: one is then to be chosen', () => {
  expect(stageToEnter(funnel, { last: 'old' })).toBeUndefined();
  expect(stageToEnter(funnel, { last: null })).toBeUndefined();
  expect(stageToEnter(funnel, {})).toBeUndefined();
  // A Stage chosen but gone is not made up for by the last one reached.
  expect(stageToEnter(funnel, { chosen: 'old', last: 'closing' })).toBeUndefined();
});

test('a change of Stage reads forward or back in the order of the Funnel, with the positions of both Stages', () => {
  const three = funnelOf([...stages, { id: 'screening', archived: false }]);
  expect(stageMove(three, 'approach', 'screening')).toEqual({
    fromPosition: 0,
    toPosition: 2,
    forward: true,
  });
  expect(stageMove(three, 'screening', 'closing')).toEqual({
    fromPosition: 2,
    toPosition: 1,
    forward: false,
  });
});

test('no change of Stage to the same one, to or from a Stage out of the Funnel', () => {
  expect(stageMove(funnel, 'approach', 'approach')).toBeUndefined();
  expect(stageMove(funnel, 'approach', 'old')).toBeUndefined();
  expect(stageMove(funnel, 'old', 'closing')).toBeUndefined();
});

test('the next Stage is the one after it in the Funnel; the last one has none', () => {
  expect(nextStageOf(funnel, 'approach')?.id).toBe('closing');
  expect(nextStageOf(funnel, 'closing')).toBeUndefined();
  expect(nextStageOf(funnel, 'old')).toBeUndefined();
});
