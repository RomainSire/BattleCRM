import axe from 'axe-core';
import { expect } from 'vitest';

/** Blocking accessibility check of the whole page (spec stack §13). */
export async function expectNoAxeViolations() {
  const { violations } = await axe.run(document);
  expect(
    violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([]);
}
