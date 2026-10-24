import { m } from '@battlecrm/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApi } from '../session.ts';
import type { NavigationCount } from '../shell/navigation.ts';
import { summaryQuery, todayOf } from '../summary.ts';
import { toHandleOf } from './to-handle.ts';

/**
 * The amber counter on Today (spec UX §3.1): the Contacts that need action and the Allies to check in
 * with, its label naming each, as “Needs action” is kept for the Contacts Prospecting; none at zero.
 */
export function useTodayCount(): NavigationCount | undefined {
  const { data: summary } = useQuery(summaryQuery(useApi()));
  if (summary === undefined) return undefined;
  const { needsAction, alliesToCheckIn } = toHandleOf(summary, todayOf(summary));
  const value = needsAction + alliesToCheckIn;
  if (value === 0) return undefined;
  const label = [
    needsAction > 0 && m.today_badge_needs_action({ count: needsAction }),
    alliesToCheckIn > 0 && m.today_badge_allies({ count: alliesToCheckIn }),
  ]
    .filter(Boolean)
    .join(', ');
  return { value, label };
}
