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
