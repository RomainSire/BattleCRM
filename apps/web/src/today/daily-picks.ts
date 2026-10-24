import { queryOptions } from '@tanstack/react-query';

import { agendaOf } from '../funnel/agenda.ts';
import type { Card } from '../funnel/next-action.tsx';
import type { ApiClient } from '../session.ts';
import type { Summary } from '../summary.ts';

export const DAILY_PICKS_KEY = ['daily-picks'];

/**
 * What Today picked for the day, the same on every device all day long (spec UX §5.1, ST-47): read
 * again for each new day, and once a Contact of the Pool comes or goes, so a Contact picked that
 * entered the Funnel is replaced. Not kept on the device: offline, Today does without.
 */
export const dailyPicksQuery = (api: ApiClient, day: string) =>
  queryOptions({
    queryKey: [...DAILY_PICKS_KEY, day],
    queryFn: async () => {
      const response = await api.today.picks.$get();
      if (!response.ok) throw new Error('GET /api/today/picks failed');
      return response.json();
    },
    retry: false,
  });

/** What Today picked for the day, as the API answers it. */
export type DailyPicks = Awaited<
  ReturnType<NonNullable<ReturnType<typeof dailyPicksQuery>['queryFn']>>
>;

/**
 * What Today shows of its picks on `today`, read against the summary: the Contacts picked still in
 * the Pool, and the ones picked still with No next step, a handled one gone without replacement
 * (spec UX §5.1). `undefined` entries while the picks are read.
 */
export function todayPicksOf(summary: Summary, picks: DailyPicks | undefined, today: string) {
  const contactsOf = (ids: readonly string[]) =>
    ids.flatMap((id) => summary.contacts.find((row) => row.id === id) ?? []);
  return {
    entries: picks && contactsOf(picks.entries).filter(({ status }) => status === 'pool'),
    noNextStep: contactsOf(picks?.noNextStep ?? [])
      .filter(({ status }) => status === 'prospecting')
      .map((contact): Card => ({ contact, agenda: agendaOf(contact, summary, today) }))
      .filter(({ agenda }) => agenda.row === 'no-next-step'),
    postponedBattleIds: picks?.postponedBattleIds ?? [],
  };
}
