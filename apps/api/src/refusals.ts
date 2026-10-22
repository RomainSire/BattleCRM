import type { Context, TypedResponse } from 'hono';

/**
 * Why a request is refused, and the status it answers with: one table for every module, each code
 * added by the module that first refuses with it.
 */
export const REFUSAL_STATUS = {
  not_found: 404,
  invalid: 400,
  past_day: 400,
  future_day: 400,
  unknown_stage: 400,
  stage_required: 400,
  unknown_organization: 400,
  unknown_positioning: 400,
  champion_required: 400,
  too_large: 413,
  same_status: 409,
  same_stage: 409,
  not_prospecting: 409,
  archived: 409,
  not_archived: 409,
  quota_exceeded: 409,
  has_contacts: 409,
  organization_taken: 409,
  linkedin_url_taken: 409,
  no_follow_up_in_status: 409,
  no_follow_up: 409,
  check_in_instead: 409,
  no_status_choice: 409,
  used: 409,
  other_stage: 409,
  battle_open: 409,
  champion_set: 409,
  champion: 409,
  in_open_battle: 409,
  in_battle: 409,
  frozen: 409,
  trial_in_progress: 409,
  no_trial: 409,
  same_outcome: 409,
  battle_closed: 409,
  already_tried: 409,
  assignment_required: 409,
  not_in_battle: 409,
  expired: 409,
  superseded: 409,
} as const;

/** Every code a request may be refused with. */
export type RefusalCode = keyof typeof REFUSAL_STATUS;

/** What a refusal carries beside its code, for the codes that carry more. */
type RefusalDetails = {
  /** The Contact that has the profile. */
  linkedin_url_taken: { contactId: string };
};

type DetailsOf<Code extends RefusalCode> = Code extends keyof RefusalDetails
  ? RefusalDetails[Code]
  : object;

/** A request refused, as its answer carries it: the code and its details, typed up to the SPA's client. */
export type Refusal<Code extends RefusalCode = RefusalCode> = Code extends RefusalCode
  ? { error: Code } & DetailsOf<Code>
  : never;

/** A refusal with this code, and its details when the code carries some, answered by `answerRefusal`. */
export const refusal = <Code extends RefusalCode>(
  error: Code,
  ...details: Code extends keyof RefusalDetails ? [RefusalDetails[Code]] : []
): Refusal<Code> =>
  // The details are the ones of the code, which TypeScript does not follow through the spread.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  ({ error, ...details[0] }) as Refusal<Code>;

/** The answer of a refusal, one per code: the client narrows the codes by the status. */
type Answered<Code extends RefusalCode> = Code extends RefusalCode
  ? Response & TypedResponse<Refusal<Code>, (typeof REFUSAL_STATUS)[Code], 'json'>
  : never;

/** Answers a refusal with the status of its code. */
export const answerRefusal = <Code extends RefusalCode>(c: Context, refused: Refusal<Code>) =>
  // Hono types one answer for every code at once; its status depends on the code.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  c.json(refused, REFUSAL_STATUS[refused.error]) as unknown as Answered<Code>;
