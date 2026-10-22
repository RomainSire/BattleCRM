import type { Verdict } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';

/** What each Verdict reads as (CONTEXT.md, Verdict). */
export const VERDICT_LABEL: Record<Verdict, () => string> = {
  challenger_wins: m.verdict_challenger_wins,
  title_defended: m.verdict_title_defended,
  draw: m.verdict_draw,
  not_enough_data: m.verdict_not_enough_data,
  abandoned: m.verdict_abandoned,
};
