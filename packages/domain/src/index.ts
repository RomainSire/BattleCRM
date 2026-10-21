// Pure domain rules shared by the API and the SPA, without I/O (spec stack §5.3).
export {
  normalizeEmail,
  normalizeLinkedInUrl,
  normalizeName,
  normalizePhone,
} from './normalize.ts';
export {
  findDuplicates,
  organizationsMatching,
  type ContactCandidate,
  type ContactIdentity,
} from './duplicates.ts';
export { targetOf, type OrganizationType, type Target } from './target.ts';
export { contactsMatching, type SearchableContact } from './search.ts';
export {
  addDays,
  daysBetween,
  funnelEntriesInWeek,
  localDay,
  mondayOf,
  nextMondayAfter,
} from './days.ts';
export { activityOn, followUpSignal, isFollowUpDue, type FollowUpSignal } from './follow-up.ts';
export {
  canNoteInteraction,
  hasFollowUps,
  isPoolOrArchived,
  statusChangeCancelsFollowUp,
} from './status.ts';
export { funnelOf, isInFunnel, stageToEnter } from './funnel.ts';
export {
  cadenceFollowUpOn,
  firstFollowUpOn,
  firstNameOf,
  personalized,
  shiftedFollowUpOn,
} from './positioning.ts';
export { chooseAssignment, type AssignmentCandidate } from './assignment.ts';
export { isWindowElapsed, responseWindowEndsOn, type TrialWindow } from './trial.ts';
