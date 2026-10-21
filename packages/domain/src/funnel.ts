// The Stages a Contact moves through (CONTEXT.md, Funnel): an archived Stage is out of the Funnel.

/** The Funnel: the Stages, in their order, the archived ones left out. */
export const funnelOf = <Stage extends { archived: boolean }>(stages: readonly Stage[]): Stage[] =>
  stages.filter(({ archived }) => !archived);

/** Whether a Stage is in the Funnel, `funnel` holding its Stages only. */
export const isInFunnel = (
  funnel: readonly { id: string }[],
  stageId: string | null | undefined,
): boolean => funnel.some(({ id }) => id === stageId);

/**
 * The Stage a Contact enters the Funnel at, coming back to Prospecting (CONTEXT.md, Status): the one
 * chosen, or else the last one it reached, while the Funnel has it. None otherwise: one is then to be
 * chosen.
 */
export function stageToEnter(
  funnel: readonly { id: string }[],
  { chosen, last }: { chosen?: string | undefined; last?: string | null | undefined },
): string | undefined {
  const wanted = chosen ?? last;
  return wanted != null && isInFunnel(funnel, wanted) ? wanted : undefined;
}

/**
 * A change of Stage in the order of the Funnel of the moment (CONTEXT.md, Funnel; ADR 0003): the
 * positions of both Stages, kept as they are so that reordering never rewrites it, and whether it goes
 * forward. None to the same Stage, or to or from one out of the Funnel.
 */
export function stageMove(
  funnel: readonly { id: string }[],
  fromId: string,
  toId: string,
): { fromPosition: number; toPosition: number; forward: boolean } | undefined {
  const fromPosition = funnel.findIndex(({ id }) => id === fromId);
  const toPosition = funnel.findIndex(({ id }) => id === toId);
  if (fromPosition < 0 || toPosition < 0 || fromPosition === toPosition) return undefined;
  return { fromPosition, toPosition, forward: toPosition > fromPosition };
}

/** The Stage after this one in the Funnel; none after the last one, or for one out of it. */
export function nextStageOf<Stage extends { id: string }>(
  funnel: readonly Stage[],
  stageId: string | null | undefined,
): Stage | undefined {
  const position = funnel.findIndex(({ id }) => id === stageId);
  return position < 0 ? undefined : funnel[position + 1];
}
