import * as fc from 'fast-check';
import { expect, test } from 'vitest';

import { chooseAssignment, type AssignmentCandidate } from './assignment.ts';

const first = () => 0;

test('the Positioning with the fewest Trials and reserved Assignments in the Target is drawn', () => {
  const candidates: AssignmentCandidate[] = [
    { positioningId: 'cv-a', load: 4, atHorizon: false },
    { positioningId: 'cv-b', load: 2, atHorizon: false },
  ];

  expect(chooseAssignment(candidates, first)).toBe('cv-b');
});

test('a tie is settled by chance, among the tied ones only', () => {
  const candidates: AssignmentCandidate[] = [
    { positioningId: 'cv-a', load: 3, atHorizon: false },
    { positioningId: 'cv-b', load: 3, atHorizon: false },
  ];
  const asked: number[] = [];

  expect(chooseAssignment(candidates, (count) => (asked.push(count), 1))).toBe('cv-b');
  expect(chooseAssignment(candidates, () => 0)).toBe('cv-a');
  expect(asked).toEqual([2]);
});

test('a Positioning that reached the Horizon is never drawn; none when both did', () => {
  expect(
    chooseAssignment(
      [
        { positioningId: 'cv-a', load: 0, atHorizon: true },
        { positioningId: 'cv-b', load: 9, atHorizon: false },
      ],
      first,
    ),
  ).toBe('cv-b');
  expect(
    chooseAssignment(
      [
        { positioningId: 'cv-a', load: 0, atHorizon: true },
        { positioningId: 'cv-b', load: 9, atHorizon: true },
      ],
      first,
    ),
  ).toBeUndefined();
});

test('drawn one after the other, the Assignments of a Target never differ by more than one', () => {
  fc.assert(
    fc.property(
      fc.array(fc.nat(), { minLength: 1, maxLength: 60 }),
      fc.nat({ max: 5 }),
      (chances, head) => {
        // One Positioning starts ahead, as after a Trial before the first draw.
        const loads = new Map([
          ['cv-a', head],
          ['cv-b', 0],
        ]);
        for (const chance of chances) {
          const drawn = chooseAssignment(
            [...loads].map(([positioningId, load]) => ({ positioningId, load, atHorizon: false })),
            (count) => chance % count,
          );
          if (drawn === undefined) return false;
          loads.set(drawn, (loads.get(drawn) ?? 0) + 1);
        }
        const [a = 0, b = 0] = loads.values();
        // Once caught up, never more than one apart; until then, only the one behind is drawn.
        return Math.abs(a - b) <= Math.max(1, head - chances.length);
      },
    ),
  );
});

test('whatever the chance, what is drawn is one of the lightest not at the Horizon', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({ load: fc.nat({ max: 30 }), atHorizon: fc.boolean() }), {
        minLength: 1,
        maxLength: 4,
      }),
      fc.nat(),
      (drafted, chance) => {
        const candidates = drafted.map((candidate, index) => ({
          positioningId: `p${index}`,
          ...candidate,
        }));
        const drawn = chooseAssignment(candidates, (count) => chance % count);
        const open = candidates.filter(({ atHorizon }) => !atHorizon);
        if (open.length === 0) return drawn === undefined;
        const lightest = Math.min(...open.map(({ load }) => load));
        return open.some(({ positioningId, load }) => positioningId === drawn && load === lightest);
      },
    ),
  );
});
