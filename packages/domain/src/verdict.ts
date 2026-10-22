// The Verdict of a Battle (CONTEXT.md, Verdict; ADR 0001): what the User closes it with, judged
// against the Win rule, by the API and by the closing window alike (ADR 0012).

import type { WinRule } from './win-rule.ts';

/** The Verdicts of a closed Battle (CONTEXT.md): Challenger wins, Title defended, Draw, Not enough data, Abandoned. */
export const VERDICTS = [
  'challenger_wins',
  'title_defended',
  'draw',
  'not_enough_data',
  'abandoned',
] as const;
export type Verdict = (typeof VERDICTS)[number];

type Standing = Pick<WinRule, 'state' | 'winner'>;

/** The Verdict the Win rule proposes, preselected at closing: none before it is conclusive or at the Horizon. */
export function proposedVerdict({ state, winner }: Standing): Verdict | undefined {
  if (state === 'conclusive') return winner === 'challenger' ? 'challenger_wins' : 'title_defended';
  if (state === 'draw' || state === 'not_enough_data') return state;
  return undefined;
}

/**
 * Whether a Verdict is designated by the User (ADR 0001): a winner the Win rule does not satisfy, which
 * the User may declare after a warning. Abandoning is always possible. A draw or not enough data is
 * only what the rule finds: `undefined` otherwise.
 */
export function judgeVerdict(standing: Standing, verdict: Verdict) {
  if (verdict === 'abandoned') return { designated: false };
  const proposed = proposedVerdict(standing);
  if (verdict === 'draw' || verdict === 'not_enough_data') {
    return proposed === verdict ? { designated: false } : undefined;
  }
  return { designated: proposed !== verdict };
}

/** Who holds the title once closed: the Challenger only when it wins, the Champion otherwise. */
export const titleHolderAfter = (verdict: Verdict) =>
  verdict === 'challenger_wins' ? 'challenger' : 'champion';

/**
 * Who is archived once closed: the one beaten, the Challenger as soon as it does not win, except in an
 * abandoned Battle, which taught nothing about either (CONTEXT.md, Positioning).
 */
export function archivedBy(verdict: Verdict) {
  if (verdict === 'abandoned') return undefined;
  return verdict === 'challenger_wins' ? 'champion' : 'challenger';
}
