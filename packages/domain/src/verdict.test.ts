import { describe, expect, test } from 'vitest';

import { archivedBy, judgeVerdict, proposedVerdict, titleHolderAfter } from './verdict.ts';
import type { WinRule } from './win-rule.ts';

/** Where a Battle stands, as the closing reads it. */
const conclusiveFor = (winner: 'champion' | 'challenger'): Pick<WinRule, 'state' | 'winner'> => ({
  state: 'conclusive',
  winner,
});
const standing = (state: 'too_early' | 'in_progress' | 'draw' | 'not_enough_data') => ({
  state,
  winner: undefined,
});

describe('the Verdict the Win rule proposes', () => {
  test('the winner once conclusive, a draw or not enough data at the Horizon, none before', () => {
    expect(proposedVerdict(conclusiveFor('challenger'))).toBe('challenger_wins');
    expect(proposedVerdict(conclusiveFor('champion'))).toBe('title_defended');
    expect(proposedVerdict(standing('draw'))).toBe('draw');
    expect(proposedVerdict(standing('not_enough_data'))).toBe('not_enough_data');
    expect(proposedVerdict(standing('too_early'))).toBeUndefined();
    expect(proposedVerdict(standing('in_progress'))).toBeUndefined();
  });
});

describe('a Verdict the User closes a Battle with', () => {
  test('the one the Win rule proposes is not designated', () => {
    expect(judgeVerdict(conclusiveFor('challenger'), 'challenger_wins')).toEqual({
      designated: false,
    });
    expect(judgeVerdict(standing('draw'), 'draw')).toEqual({ designated: false });
    expect(judgeVerdict(standing('not_enough_data'), 'not_enough_data')).toEqual({
      designated: false,
    });
  });

  test('a winner the rule does not satisfy is designated by the User', () => {
    expect(judgeVerdict(conclusiveFor('challenger'), 'title_defended')).toEqual({
      designated: true,
    });
    expect(judgeVerdict(standing('too_early'), 'challenger_wins')).toEqual({ designated: true });
    expect(judgeVerdict(standing('draw'), 'title_defended')).toEqual({ designated: true });
  });

  test('abandoning is always possible, and designates nothing', () => {
    expect(judgeVerdict(standing('in_progress'), 'abandoned')).toEqual({ designated: false });
    expect(judgeVerdict(conclusiveFor('champion'), 'abandoned')).toEqual({ designated: false });
  });

  test('a draw or not enough data only as the rule finds them', () => {
    expect(judgeVerdict(standing('in_progress'), 'draw')).toBeUndefined();
    expect(judgeVerdict(conclusiveFor('challenger'), 'not_enough_data')).toBeUndefined();
    expect(judgeVerdict(standing('draw'), 'not_enough_data')).toBeUndefined();
  });
});

describe('what a Verdict leaves', () => {
  test('the Challenger takes the title only when it wins; the Champion keeps it otherwise', () => {
    expect(titleHolderAfter('challenger_wins')).toBe('challenger');
    for (const verdict of ['title_defended', 'draw', 'not_enough_data', 'abandoned'] as const) {
      expect(titleHolderAfter(verdict)).toBe('champion');
    }
  });

  test('the one beaten is archived; the Challenger of an abandoned Battle stays available', () => {
    expect(archivedBy('challenger_wins')).toBe('champion');
    expect(archivedBy('title_defended')).toBe('challenger');
    expect(archivedBy('draw')).toBe('challenger');
    expect(archivedBy('not_enough_data')).toBe('challenger');
    expect(archivedBy('abandoned')).toBeUndefined();
  });
});
