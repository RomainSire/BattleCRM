/**
 * A Positioning an open Battle may assign (CONTEXT.md, Assignment): its load, the Trials and the
 * Assignments still reserved among the Contacts of the same Target, and whether it reached the Horizon.
 */
export type AssignmentCandidate = { positioningId: string; load: number; atHorizon: boolean };

/**
 * The Assignment of a Contact (ADR 0002): the Positioning with the lightest load among those not at
 * the Horizon, chance settling a tie; `undefined` when every one reached it. `random(count)` gives an
 * integer in [0, count): the API passes its own source of chance, never `Math.random`.
 */
export function chooseAssignment(
  candidates: readonly AssignmentCandidate[],
  random: (count: number) => number,
): string | undefined {
  const open = candidates.filter(({ atHorizon }) => !atHorizon);
  if (open.length === 0) return undefined;
  const lightest = Math.min(...open.map(({ load }) => load));
  const tied = open.filter(({ load }) => load === lightest);
  if (tied.length === 1) return tied[0]?.positioningId;
  return tied[random(tied.length)]?.positioningId;
}
