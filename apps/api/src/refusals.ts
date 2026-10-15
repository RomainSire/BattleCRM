import type { Context, TypedResponse } from 'hono';

/**
 * Why a request is refused, and the status it answers with: one table for every module, each code
 * added by the module that first refuses with it.
 */
export const REFUSAL_STATUS = {
  not_found: 404,
  past_day: 400,
  no_follow_up_in_status: 409,
  expired: 409,
  superseded: 409,
} as const;

/** Every code a request may be refused with. */
export type RefusalCode = keyof typeof REFUSAL_STATUS;

/** A request refused, as its answer carries it: the code, typed up to the SPA's client. */
export type Refusal<Code extends RefusalCode = RefusalCode> = { error: Code };

/** A refusal with this code, answered by `answerRefusal`. */
export const refusal = <Code extends RefusalCode>(error: Code): Refusal<Code> => ({ error });

/** The answer of a refusal, one per code: the client narrows the codes by the status. */
type Answered<Code extends RefusalCode> = Code extends RefusalCode
  ? Response & TypedResponse<{ error: Code }, (typeof REFUSAL_STATUS)[Code], 'json'>
  : never;

/** Answers a refusal with the status of its code. */
export const answerRefusal = <Code extends RefusalCode>(c: Context, refused: Refusal<Code>) =>
  // Hono types one answer for every code at once; its status depends on the code.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  c.json(refused, REFUSAL_STATUS[refused.error]) as unknown as Answered<Code>;
