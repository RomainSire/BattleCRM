// What using a Positioning computes (spec UX §6.1): read the same on the device and by the API.

import { addDays } from './days.ts';

/** What a Positioning writes for the first name of the Contact, in each language of the app. */
const FIRST_NAME_TOKENS = ['{prénom}', '{first name}'] as const;

/** The first name of a Contact: the first word of its name. */
export const firstNameOf = (name: string): string => name.trim().split(/\s+/u)[0] ?? '';

/** What a Positioning sends to a Contact: every token of the first name replaced by its own (ST-60). */
export const personalized = (content: string, contactName: string): string =>
  FIRST_NAME_TOKENS.reduce(
    (text, token) => text.replaceAll(token, firstNameOf(contactName)),
    content,
  );

/**
 * The local day of the Follow-up of a rank of the Cadence, from 1: its interval after the last
 * outbound Interaction done (CONTEXT.md, Follow-up cadence); none past the last rank, when only the
 * Response window is left.
 */
export const cadenceFollowUpOn = (
  rank: number,
  lastOutboundOn: string,
  followUpDays: readonly number[],
) => {
  const days = followUpDays[rank - 1];
  return days === undefined ? undefined : addDays(lastOutboundOn, days);
};

/** The local day of the first Follow-up of a Cadence, its first interval after the use. */
export const firstFollowUpOn = (usedOn: string, followUpDays: readonly number[]) =>
  cadenceFollowUpOn(1, usedOn, followUpDays);

/**
 * The day of a scheduled Follow-up once an outbound Interaction is done (spec UX §6.4): of the
 * Cadence, its interval counts from the last one, which pushes it back, never forward (a day the User
 * moved later stays); off the Cadence, it stays.
 */
export function shiftedFollowUpOn(
  { dueOn, rank }: { dueOn: string; rank: number | null },
  lastOutboundOn: string,
  followUpDays: readonly number[],
) {
  const shifted = rank === null ? undefined : cadenceFollowUpOn(rank, lastOutboundOn, followUpDays);
  return shifted !== undefined && shifted > dueOn ? shifted : dueOn;
}
