/**
 * `count` items picked at random, never twice the same one, in the order picked; all of them when
 * there are fewer. `random(count)` gives an integer in [0, count): the API passes its own source of
 * chance, never `Math.random`. It is not asked when a single item is left.
 */
export function pickAtRandom<Item>(
  items: readonly Item[],
  count: number,
  random: (count: number) => number,
): Item[] {
  const left = [...items];
  const picked: Item[] = [];
  while (picked.length < count && left.length > 0) {
    const index = left.length === 1 ? 0 : random(left.length);
    picked.push(...left.splice(index, 1));
  }
  return picked;
}
