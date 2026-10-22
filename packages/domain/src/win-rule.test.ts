import * as fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { evaluateWinRule, type TrialCounts, type WinRuleCounts } from './win-rule.ts';

/** `successes` out of `finished`, none in progress. */
const finished = (successes: number, total: number): TrialCounts => ({
  successes,
  noResults: total - successes,
  inProgress: 0,
});

const counts = (champion: TrialCounts, challenger: TrialCounts): WinRuleCounts => ({
  champion,
  challenger,
});

describe('the probability that the Challenger is better', () => {
  // Reference values: .scratch/battlecrm/research/01-methode-statistique.md, §2 (Evan Miller's exact formula).
  test.each([
    // oxlint-disable-next-line approx-constant -- a reference value of the research, not √½.
    [finished(2, 10), finished(1, 10), 0.707],
    [finished(1, 12), finished(0, 12), 0.76],
    [finished(3, 15), finished(1, 15), 0.834],
    [finished(6, 20), finished(3, 20), 0.861],
    [finished(5, 20), finished(2, 20), 0.881],
    [finished(4, 25), finished(1, 25), 0.905],
    [finished(10, 25), finished(5, 25), 0.934],
    [finished(8, 25), finished(3, 25), 0.951],
    [finished(15, 50), finished(7, 50), 0.972],
  ])('Challenger %o against Champion %o: %d', (challenger, champion, expected) => {
    const { probability } = evaluateWinRule(counts(champion, challenger), 0.85, 100);

    expect(probability).toBeCloseTo(expected, 2);
  });

  test('is one half without any data, and between equal counts', () => {
    expect(evaluateWinRule(counts(finished(0, 0), finished(0, 0)), 0.85, 25).probability).toBe(0.5);
    expect(
      evaluateWinRule(counts(finished(4, 13), finished(4, 13)), 0.85, 25).probability,
    ).toBeCloseTo(0.5, 9);
  });

  test('ignores the Trials in progress', () => {
    const settled = evaluateWinRule(counts(finished(3, 12), finished(5, 12)), 0.85, 25);
    const withInProgress = evaluateWinRule(
      counts({ ...finished(3, 12), inProgress: 4 }, { ...finished(5, 12), inProgress: 2 }),
      0.85,
      25,
    );

    expect(withInProgress.probability).toBe(settled.probability);
  });
});

describe('the state of a Battle', () => {
  test('too early below 10 finished Trials for either Positioning, with what is missing', () => {
    const rule = evaluateWinRule(
      counts({ ...finished(1, 9), inProgress: 3 }, finished(8, 12)),
      0.85,
      25,
    );

    expect(rule.state).toBe('too_early');
    expect(rule.minimumReached).toBe(false);
    expect(rule.missing).toEqual({ champion: 1, challenger: 0, successes: 0 });
  });

  test('too early below 5 successes in all, however lopsided', () => {
    const rule = evaluateWinRule(counts(finished(0, 15), finished(4, 15)), 0.85, 25);

    expect(rule.state).toBe('too_early');
    expect(rule.missing).toEqual({ champion: 0, challenger: 0, successes: 1 });
  });

  test('in progress once the minimum is reached, below the threshold', () => {
    const rule = evaluateWinRule(counts(finished(3, 20), finished(6, 20)), 0.9, 25);

    expect(rule.state).toBe('in_progress');
    expect(rule.minimumReached).toBe(true);
    expect(rule.winner).toBeUndefined();
  });

  test('conclusive for the Challenger at the threshold', () => {
    const rule = evaluateWinRule(counts(finished(2, 20), finished(5, 20)), 0.85, 25);

    expect(rule.state).toBe('conclusive');
    expect(rule.winner).toBe('challenger');
  });

  test('conclusive for the Champion when the Challenger is likely worse', () => {
    const rule = evaluateWinRule(counts(finished(8, 25), finished(3, 25)), 0.85, 30);

    expect(rule.state).toBe('conclusive');
    expect(rule.winner).toBe('champion');
  });

  test('the threshold of the Battle decides', () => {
    const challengerAhead = counts(finished(2, 20), finished(5, 20));

    expect(evaluateWinRule(challengerAhead, 0.85, 25).state).toBe('conclusive');
    expect(evaluateWinRule(challengerAhead, 0.9, 25).state).toBe('in_progress');
  });

  test('a draw once both Positionings started the Horizon, in progress ones counted', () => {
    const rule = evaluateWinRule(
      counts({ ...finished(6, 22), inProgress: 3 }, finished(7, 25)),
      0.85,
      25,
    );

    expect(rule.horizonReached).toBe(true);
    expect(rule.state).toBe('draw');
    expect(rule.winner).toBeUndefined();
  });

  test('not a draw while only one Positioning reached the Horizon', () => {
    const rule = evaluateWinRule(counts(finished(6, 25), finished(7, 24)), 0.85, 25);

    expect(rule.horizonReached).toBe(false);
    expect(rule.state).toBe('in_progress');
  });

  test('not enough data at the Horizon with fewer than 3 successes in all', () => {
    expect(evaluateWinRule(counts(finished(1, 25), finished(1, 25)), 0.85, 25).state).toBe(
      'not_enough_data',
    );
    expect(evaluateWinRule(counts(finished(1, 25), finished(2, 25)), 0.85, 25).state).toBe('draw');
  });

  test('conclusive at the Horizon wins over a draw', () => {
    const rule = evaluateWinRule(counts(finished(3, 25), finished(8, 25)), 0.85, 25);

    expect(rule.horizonReached).toBe(true);
    expect(rule.state).toBe('conclusive');
    expect(rule.winner).toBe('challenger');
  });
});

describe('properties', () => {
  const side = fc
    .record({
      successes: fc.nat({ max: 60 }),
      noResults: fc.nat({ max: 60 }),
      inProgress: fc.nat({ max: 10 }),
    })
    .map((value): TrialCounts => value);

  test('the probability stays within [0, 1]', () => {
    fc.assert(
      fc.property(side, side, (champion, challenger) => {
        const { probability } = evaluateWinRule(counts(champion, challenger), 0.85, 25);
        expect(probability).toBeGreaterThanOrEqual(0);
        expect(probability).toBeLessThanOrEqual(1);
      }),
    );
  });

  test('swapping the two Positionings mirrors the probability and the winner', () => {
    fc.assert(
      fc.property(side, side, (champion, challenger) => {
        const rule = evaluateWinRule(counts(champion, challenger), 0.85, 25);
        const swapped = evaluateWinRule(counts(challenger, champion), 0.85, 25);
        expect(swapped.probability).toBeCloseTo(1 - rule.probability, 9);
        expect(swapped.state).toBe(rule.state);
      }),
    );
  });

  test('one more success for the Challenger never lowers its probability', () => {
    fc.assert(
      fc.property(side, side, (champion, challenger) => {
        const before = evaluateWinRule(counts(champion, challenger), 0.85, 25);
        const after = evaluateWinRule(
          counts(champion, { ...challenger, successes: challenger.successes + 1 }),
          0.85,
          25,
        );
        expect(after.probability).toBeGreaterThanOrEqual(before.probability - 1e-12);
      }),
    );
  });

  test('no verdict before the minimum', () => {
    fc.assert(
      fc.property(side, side, (champion, challenger) => {
        const rule = evaluateWinRule(counts(champion, challenger), 0.85, 100);
        const enough =
          champion.successes + champion.noResults >= 10 &&
          challenger.successes + challenger.noResults >= 10 &&
          champion.successes + challenger.successes >= 5;
        fc.pre(!enough);
        expect(rule.state).toBe('too_early');
      }),
    );
  });
});
