// What a Contact's Status allows (CONTEXT.md, Status): checked by the API, announced by the SPA.

/** The Status of a Contact (CONTEXT.md), as the contract lists it: a Status added there no longer fits here, and fails to compile. */
type ContactStatus = 'pool' | 'prospecting' | 'ally' | 'archived';

/** Only a Contact Prospecting and an Ally have a Follow-up (CONTEXT.md, Follow-up). */
export const hasFollowUps = (status: ContactStatus): boolean =>
  status === 'prospecting' || status === 'ally';

/** In the Pool or Archived: out of the Funnel and of the Circle, where the way back is the gesture of the moment. */
export const isPoolOrArchived = (status: ContactStatus): boolean =>
  status === 'pool' || status === 'archived';

/**
 * Whether a change of Status to `to` cancels the scheduled Follow-up: leaving Prospecting does, as
 * going to the Pool or Archived does; an Ally entering the Funnel keeps its own (CONTEXT.md, Follow-up).
 */
export const statusChangeCancelsFollowUp = (to: ContactStatus): boolean => to !== 'prospecting';

/** “Note an Interaction” is for any Contact but an Ally: with one, it is a Check-in (CONTEXT.md, Check-in). */
export const canNoteInteraction = (status: ContactStatus): boolean => status !== 'ally';
