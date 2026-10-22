// The Win rule (ADR 0001): exact and deterministic, so the gauge of the SPA and the API give the same
// figure (ADR 0012).

/** The minimum before any verdict, not settable (ADR 0001): finished Trials per Positioning, successes in all. */
export const BATTLE_MINIMUM_FINISHED = 10;
export const BATTLE_MINIMUM_SUCCESSES = 5;
/** Below this many successes in all, a Battle that reached the Horizon taught nothing (CONTEXT.md, Verdict). */
const ENOUGH_DATA_SUCCESSES = 3;

/** The Trials of one Positioning in a Battle, the canceled ones aside: they are not counted. */
export type TrialCounts = { successes: number; noResults: number; inProgress: number };

export type WinRuleCounts = { champion: TrialCounts; challenger: TrialCounts };

/**
 * Where a Battle stands (spec UX §5.5): too early below the minimum, in progress above it, conclusive
 * once one Positioning reaches the threshold, a draw or not enough data once both reached the Horizon.
 */
export type WinRuleState = 'too_early' | 'in_progress' | 'conclusive' | 'draw' | 'not_enough_data';

export type WinRule = {
  state: WinRuleState;
  /** P(Challenger better than Champion), under a uniform prior on each. */
  probability: number;
  minimumReached: boolean;
  /** Whether both Positionings started the Horizon, the canceled Trials aside. */
  horizonReached: boolean;
  /** The Positioning the rule designates, once conclusive. */
  winner: 'champion' | 'challenger' | undefined;
  /** What the minimum still lacks: finished Trials of each, successes in all. */
  missing: { champion: number; challenger: number; successes: number };
};

/** log(n!), summed: exact enough, and the same on every engine that rounds `Math.log` alike. */
const logFactorials: number[] = [0];
function logFactorial(n: number): number {
  for (let k = logFactorials.length; k <= n; k += 1) {
    logFactorials[k] = (logFactorials[k - 1] ?? 0) + Math.log(k);
  }
  return logFactorials[n] ?? 0;
}

/** log B(a, b) for positive integers. */
const logBeta = (a: number, b: number) =>
  logFactorial(a - 1) + logFactorial(b - 1) - logFactorial(a + b - 1);

/**
 * P(p_B > p_A) for p_A ~ Beta(αA, βA) and p_B ~ Beta(αB, βB), integer parameters: Evan Miller's closed
 * form (https://www.evanmiller.org/bayesian-ab-testing.html), no Monte Carlo.
 */
function probabilityBetter(alphaA: number, betaA: number, alphaB: number, betaB: number) {
  let total = 0;
  for (let i = 0; i < alphaB; i += 1) {
    total += Math.exp(
      logBeta(alphaA + i, betaA + betaB) -
        Math.log(betaB + i) -
        logBeta(1 + i, betaB) -
        logBeta(alphaA, betaA),
    );
  }
  return Math.min(1, Math.max(0, total));
}

/** The finished Trials of one Positioning: Successes and No results. */
export const finishedTrials = ({ successes, noResults }: TrialCounts) => successes + noResults;

/** The Trials one Positioning started, the canceled ones aside: what the Horizon counts. */
export const startedTrials = (counts: TrialCounts) => finishedTrials(counts) + counts.inProgress;

/**
 * The Win rule of a Battle (ADR 0001): conclusive when P(Challenger > Champion) reaches the threshold,
 * or falls to its complement for the Champion, once each Positioning has 10 finished Trials and both 5
 * successes in all. The Horizon, Trials started the canceled ones aside, concludes it otherwise.
 */
export function evaluateWinRule(
  { champion, challenger }: WinRuleCounts,
  threshold: number,
  horizon: number,
): WinRule {
  // The two are measured alike, so the result mirrors exactly when they swap.
  const probability =
    champion.successes === challenger.successes && champion.noResults === challenger.noResults
      ? 0.5
      : probabilityBetter(
          1 + champion.successes,
          1 + champion.noResults,
          1 + challenger.successes,
          1 + challenger.noResults,
        );
  const successes = champion.successes + challenger.successes;
  const missing = {
    champion: Math.max(0, BATTLE_MINIMUM_FINISHED - finishedTrials(champion)),
    challenger: Math.max(0, BATTLE_MINIMUM_FINISHED - finishedTrials(challenger)),
    successes: Math.max(0, BATTLE_MINIMUM_SUCCESSES - successes),
  };
  const minimumReached =
    missing.champion === 0 && missing.challenger === 0 && missing.successes === 0;
  const horizonReached = startedTrials(champion) >= horizon && startedTrials(challenger) >= horizon;
  let winner: WinRule['winner'];
  if (minimumReached && probability >= threshold) winner = 'challenger';
  else if (minimumReached && probability <= 1 - threshold) winner = 'champion';
  let state: WinRuleState;
  if (winner) state = 'conclusive';
  else if (horizonReached) state = successes < ENOUGH_DATA_SUCCESSES ? 'not_enough_data' : 'draw';
  else state = minimumReached ? 'in_progress' : 'too_early';
  return { state, probability, minimumReached, horizonReached, winner, missing };
}
