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
 * The local day of the first Follow-up of a Cadence, its first interval after the use (CONTEXT.md,
 * Follow-up cadence); none when the Cadence has no interval, only its Response window.
 */
export const firstFollowUpOn = (usedOn: string, followUpDays: readonly number[]) => {
  const [days] = followUpDays;
  return days === undefined ? undefined : addDays(usedOn, days);
};
