import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Blocking accessibility check of the whole page (spec stack §13), once its animations and
 * transitions are over: a panel fading in, or a colour on its way to the theme, is no colour to judge.
 */
export async function expectNoAxeViolations() {
  await Promise.all(
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => undefined)),
  );
  const { violations } = await axe.run(document);
  expect(
    violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([]);
}
