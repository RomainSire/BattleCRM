import type { ContactStatus } from '@battlecrm/contract';
import {
  daysBetween,
  followUpSignal,
  isFollowUpDueIn,
  type ContactAgenda,
} from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { cn } from 'cn';

import { Button } from '../components/ui/button.tsx';
import type { Locale } from '../i18n.ts';
import { positioningsOf, trialOf, type Summary, type SummaryContact } from '../summary.ts';
import {
  followUpTitle,
  PostponeFollowUp,
  useFollowUpQuickGestures,
} from '../contacts/follow-up.tsx';
import { formatLocalDay } from '../contacts/format.ts';

/** A Contact Prospecting of the Funnel, with what it has next. */
export type Card = { contact: SummaryContact; agenda: ContactAgenda };

/** A scheduled Follow-up and its rank: overdue by so many days, today, or on its day. */
export function followUpText(
  followUp: NonNullable<SummaryContact['followUp']>,
  today: string,
  locale: Locale,
) {
  const title = followUpTitle(followUp);
  switch (followUpSignal(followUp.dueOn, today)) {
    case 'overdue':
      return m.funnel_card_follow_up_overdue({
        followUp: title,
        days: daysBetween(followUp.dueOn, today),
      });
    case 'today':
      return m.funnel_card_follow_up_today({ followUp: title });
    default:
      return m.funnel_card_follow_up_upcoming({
        followUp: title,
        date: formatLocalDay(followUp.dueOn, locale),
      });
  }
}

/**
 * The Trial in progress of a Contact: past its Response window, or the day a reply is expected by, or
 * its Positioning alone while a Follow-up comes first; `undefined` without one.
 */
export function trialText({ contact, agenda }: Card, summary: Summary, locale: Locale) {
  const trial = trialOf(contact);
  if (trial === null) return undefined;
  const label = positioningsOf(summary).find(({ id }) => id === trial.positioningId)?.label ?? '';
  if (agenda.row === 'needs-action' && agenda.reason === 'window-elapsed') {
    return m.funnel_card_trial_elapsed({ label });
  }
  if (agenda.row === 'waiting' && agenda.reason === 'trial') {
    return m.funnel_card_trial_waiting({ label, date: formatLocalDay(agenda.on, locale) });
  }
  return m.funnel_trial({ label });
}

/** What a card says comes next: its Follow-up and rank, or its Trial in progress. */
export function nextActionText(card: Card, summary: Summary, today: string, locale: Locale) {
  const { contact, agenda } = card;
  if (agenda.row === 'no-next-step') return m.no_next_action();
  if (agenda.reason === 'no-positioning') return m.funnel_card_no_positioning();
  if (
    contact.followUp !== null &&
    agenda.reason !== 'trial' &&
    agenda.reason !== 'window-elapsed'
  ) {
    return followUpText(contact.followUp, today, locale);
  }
  return trialText(card, summary, locale) ?? '';
}

/** How a card opens a gesture on its Contact: the gestures of the record, kept by the address (ST-70). */
export type OpenGesture = (contactId: string, search: FunnelGestureSearch) => void;
export type FunnelGestureSearch = {
  statusTo?: 'choose' | ContactStatus;
  stageTo?: string;
  followUp?: 'schedule' | 'do' | 'anyway';
  interaction?: 'note' | 'reply';
  send?: 'positioning';
  trial?: 'no-result';
  panel?: 'record';
};

/**
 * The shortcuts of a card, the same as on Today so that a Contact is handled the same way everywhere
 * (spec UX §5.1, §5.2): a Follow-up due, a Trial past its window, nothing next.
 */
export function CardActions({
  card,
  summary,
  open,
}: {
  card: Card;
  summary: Summary;
  open: (search: FunnelGestureSearch) => void;
}) {
  const { contact, agenda } = card;
  const { postpone, cancel, isBusy } = useFollowUpQuickGestures(contact, summary);
  const action = 'max-md:min-h-11';
  if (isFollowUpDueIn(agenda)) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className={cn('font-semibold', action)}
          onPress={() => open({ followUp: 'do' })}
        >
          {m.verb_follow_up()}
        </Button>
        <PostponeFollowUp onPostpone={postpone} />
        <Button
          variant="ghost"
          size="sm"
          className={action}
          aria-label={m.verb_cancel_follow_up()}
          isDisabled={isBusy}
          onPress={cancel}
        >
          {m.cancel()}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={action}
          onPress={() => open({ interaction: 'reply' })}
        >
          {m.verb_reply()}
        </Button>
      </div>
    );
  }
  if (agenda.row === 'needs-action') {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className={cn('font-semibold', action)}
          onPress={() => open({ trial: 'no-result' })}
        >
          {m.verb_no_result()}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={action}
          onPress={() => open({ followUp: 'anyway' })}
        >
          {m.verb_follow_up_anyway()}
        </Button>
      </div>
    );
  }
  if (agenda.row === 'no-next-step') {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className={cn('font-semibold', action)}
          onPress={() => open({ send: 'positioning' })}
        >
          {m.verb_use_positioning()}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={action}
          onPress={() => open({ followUp: 'schedule' })}
        >
          {m.verb_schedule_follow_up()}
        </Button>
      </div>
    );
  }
  return null;
}
