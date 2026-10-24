// The states of the day of a Follow-up and the Activity, never stored (spec stack §5.3): read from local days.

/** What a scheduled Follow-up signals on a local day: overdue once its day is past (CONTEXT.md, Follow-up). */
export type FollowUpSignal = 'overdue' | 'today' | 'upcoming';

export function followUpSignal(dueOn: string, today: string): FollowUpSignal {
  if (dueOn < today) return 'overdue';
  return dueOn === today ? 'today' : 'upcoming';
}

/** Whether a scheduled Follow-up is due on a local day: on its day, or overdue. */
export const isFollowUpDue = (dueOn: string, today: string): boolean =>
  followUpSignal(dueOn, today) !== 'upcoming';

/** The Activity of a local day: the Prospecting actions dated that day, on every Contact (CONTEXT.md). */
export const activityOn = (
  contacts: readonly { prospectingActionDays: readonly string[] }[],
  day: string,
): number =>
  contacts.flatMap(({ prospectingActionDays }) => prospectingActionDays).filter((on) => on === day)
    .length;

/** Whether the Activity of a day reaches its Activity goal: never with the goal turned off (CONTEXT.md). */
export const activityGoalReached = (activity: number, goal: number | null): boolean =>
  goal !== null && activity >= goal;
