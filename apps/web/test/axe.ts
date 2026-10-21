import axe from 'axe-core';
import { expect } from 'vitest';
import { commands } from 'vitest/browser';

const runningAnimations = () =>
  document
    .getAnimations()
    .filter((animation) => animation.effect?.getTiming().iterations !== Infinity);

/**
 * Blocking accessibility check of the whole page (spec stack §13), with the pointer away from every
 * control and once its animations and transitions are over: a hover, a panel fading in, or a colour
 * on its way to the theme, is no colour to judge.
 */
export async function expectNoAxeViolations() {
  await commands.parkPointer();
  // One that ends may let another start, as a hover that leaves.
  for (let running = runningAnimations(); running.length > 0; running = runningAnimations()) {
    await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
  }
  const { violations } = await axe.run(document);
  expect(
    violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([]);
}
