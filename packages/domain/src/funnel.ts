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
