import * as fc from 'fast-check';
import { expect, test } from 'vitest';

import { pickAtRandom } from './pick.ts';

test('chance chooses each pick among the ones left, in the order picked', () => {
  const asked: number[] = [];
  const answers = [2, 0];
  const random = (count: number) => (asked.push(count), answers.shift() ?? 0);

  expect(pickAtRandom(['a', 'b', 'c', 'd'], 2, random)).toEqual(['c', 'a']);
  expect(asked).toEqual([4, 3]);
});

test('fewer items than asked: all of them, chance never asked for the last one', () => {
  const asked: number[] = [];

  expect(pickAtRandom(['a', 'b'], 3, (count) => (asked.push(count), 1))).toEqual(['b', 'a']);
  expect(asked).toEqual([2]);
  expect(pickAtRandom([], 3, () => 0)).toEqual([]);
});

test('a pick is never twice the same item, and never more than asked', () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(fc.integer()),
      fc.nat(6),
      fc.infiniteStream(fc.nat()),
      (items, count, chances) => {
        const picked = pickAtRandom(items, count, (n) => chances.next().value % n);
        expect(picked).toHaveLength(Math.min(count, items.length));
        expect(new Set(picked).size).toBe(picked.length);
        expect(picked.every((item) => items.includes(item))).toBe(true);
      },
    ),
  );
});
