import { FOLLOW_UP_NOTE_MAX_LENGTH } from '@battlecrm/contract';
import { activityOn, addDays, followUpSignal, hasFollowUps } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useId, useRef } from 'react';
import { Form, TextField } from 'react-aria-components';
import { z } from 'zod';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage, FieldErrorMessage } from '../components/ui/error-message.tsx';
import {
  GesturePanel,
  GesturePanelBody,
  GesturePanelFooter,
} from '../components/ui/gesture-panel.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import { MenuItem, MoreActions } from '../components/ui/menu.tsx';
import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '../components/ui/segmented-control.tsx';
import { notify } from '../components/ui/toast.tsx';
import { useSendGesture, type RefusalOf } from '../gesture.ts';
import { useLocale, type Locale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';
import { useSessionDraft } from '../session-draft.ts';
import { settingsOf } from '../settings/use-settings.ts';
import { todayOf, type Summary, type SummaryContact } from '../summary.ts';
import { contactRecordQuery } from './contact-record-query.ts';
import { formatLocalDay } from './format.ts';
import type { FollowUpGesture } from './status.ts';

/**
 * The Follow-up gesture open on the record, carried by the address (ST-70): `open` shows its panel,
 * `close` takes it away.
 */
export function useFollowUpGesture() {
  const { followUp } = useSearch({ strict: false });
  const navigate = useNavigate();
  return {
    gesture: followUp,
    open: (gesture: FollowUpGesture) =>
      void navigate({ to: '.', search: (search) => ({ ...search, followUp: gesture }) }),
    close: () =>
      void navigate({
        to: '.',
        search: ({ followUp: _closed, ...search }) => search,
        replace: true,
      }),
  };
}

/** A refusal of a gesture on a Follow-up. */
type FollowUpRefusal =
  | RefusalOf<ApiClient['contacts'][':id']['schedule-follow-up']['$post']>
  | RefusalOf<ApiClient['contacts'][':id']['follow-up']['$post']>;

/** A day the server refuses is the panel's to show; anything else, a Contact changed elsewhere. */
const refusalText = (refused: FollowUpRefusal | undefined) =>
  (refused?.error === 'past_day' && m.follow_up_day_not_past()) ||
  (refused?.error === 'future_day' && m.follow_up_day_not_future()) ||
  (refused !== undefined && m.follow_up_behind());

export const trimmed = (note: string) => {
  const text = note.trim();
  return text === '' ? {} : { note: text };
};

/** The days a Follow-up is postponed by, from today (spec UX §5.3). */
const POSTPONE_DAYS = [1, 3, 7] as const;

/** The quick days of “Schedule a follow-up” (spec UX §6.5), then any date. */
const SCHEDULE_CHOICES = ['1', '3', '7', '14', 'other'] as const;
/** The day an Interaction was done on (spec UX §6.3): today, yesterday, or any date before. */
const DONE_CHOICES = ['today', 'yesterday', 'other'] as const;

const dayLabel = (choice: (typeof SCHEDULE_CHOICES)[number]) => {
  if (choice === 'other') return m.follow_up_other_day();
  if (choice === '1') return m.follow_up_tomorrow();
  return m.follow_up_in_days({ days: Number(choice) });
};

/** What a Follow-up is called: its rank in the Cadence, or off the Cadence. */
export const followUpTitle = (followUp: { rank?: number | null }) =>
  // Fallback: a summary kept on the device by a version from before ranks carries none.
  followUp.rank == null ? m.follow_up_off_cadence() : m.follow_up_rank({ rank: followUp.rank });

/**
 * The head of the thread (spec UX §5.3): the scheduled Follow-up as what comes next, its rank or off
 * the Cadence, with its signal and note, and Follow up… / Edit / Postpone / Cancel; or, without one, the reminder
 * that nothing comes next and “Schedule a follow-up”. Nothing for a Contact that has no Follow-ups.
 */
export function FollowUpHead({
  contact,
  summary,
  onGesture,
}: {
  contact: SummaryContact;
  summary: Summary;
  onGesture: (gesture: FollowUpGesture) => void;
}) {
  const locale = useLocale();
  const api = useApi();
  const sendGesture = useSendGesture();
  const headingId = useId();
  const today = todayOf(summary);
  const { name } = contact;
  const postpone = useMutation({
    mutationFn: (days: number) => {
      const dueOn = addDays(today, days);
      const date = formatLocalDay(dueOn, locale);
      return sendGesture(
        api.contacts[':id']['schedule-follow-up'].$post({
          param: { id: contact.id },
          json: { dueOn, ...trimmed(contact.followUp?.note ?? '') },
        }),
        ({ contacts: [changed] }) => changed && m.follow_up_scheduled_toast({ name, date }),
      );
    },
    onSuccess: (refused) => {
      if (refused) notify({ message: m.follow_up_behind(), isError: true });
    },
    onError: () => notify({ message: m.auth_error(), isError: true }),
  });
  const cancel = useMutation({
    mutationFn: () =>
      sendGesture(
        api.contacts[':id']['cancel-follow-up'].$post({ param: { id: contact.id } }),
        ({ contacts: [changed] }) => changed && m.follow_up_canceled_toast({ name }),
      ),
    onSuccess: (refused) => {
      if (refused) notify({ message: m.follow_up_behind(), isError: true });
    },
    onError: () => notify({ message: m.auth_error(), isError: true }),
  });
  if (!hasFollowUps(contact.status)) return null;
  const { followUp } = contact;
  if (followUp === null) {
    return (
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-card border border-dashed p-3">
        {contact.status === 'prospecting' && (
          <p className="text-muted-foreground">{m.no_next_action()}</p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="max-md:min-h-11"
          onPress={() => onGesture('schedule')}
        >
          {m.verb_schedule_follow_up()}
        </Button>
      </div>
    );
  }
  const signal = followUpSignal(followUp.dueOn, today);
  const isBusy = postpone.isPending || cancel.isPending;
  return (
    <section
      aria-labelledby={headingId}
      className="mb-3 flex flex-col gap-2 rounded-card border p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id={headingId} className="font-medium">
          {followUpTitle(followUp)}
        </h3>
        <p className="text-xs">
          <time dateTime={followUp.dueOn}>{formatLocalDay(followUp.dueOn, locale)}</time>
          {signal !== 'upcoming' && (
            <span className="font-medium text-overdue">
              {' · '}
              {signal === 'overdue' ? m.follow_up_overdue() : m.follow_up_due_today()}
            </span>
          )}
        </p>
      </div>
      {followUp.note && <p className="whitespace-pre-line">{followUp.note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="font-semibold max-md:min-h-11"
          isDisabled={isBusy}
          onPress={() => onGesture('do')}
        >
          {m.verb_follow_up()}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="max-md:min-h-11"
          aria-label={m.verb_edit_follow_up()}
          isDisabled={isBusy}
          onPress={() => onGesture('schedule')}
        >
          {m.edit()}
        </Button>
        <MoreActions
          trigger={{ text: m.follow_up_postpone(), label: m.verb_postpone_follow_up() }}
          onAction={(key) => {
            const days = POSTPONE_DAYS.find((candidate) => String(candidate) === key);
            if (days !== undefined && !isBusy) postpone.mutate(days);
          }}
        >
          {POSTPONE_DAYS.map((days) => (
            <MenuItem key={days} id={String(days)}>
              {days === 1 ? m.follow_up_tomorrow() : m.follow_up_in_days({ days })}
            </MenuItem>
          ))}
        </MoreActions>
        <Button
          variant="ghost"
          size="sm"
          className="max-md:min-h-11"
          aria-label={m.verb_cancel_follow_up()}
          isDisabled={isBusy}
          onPress={() => cancel.mutate()}
        >
          {m.cancel()}
        </Button>
      </div>
    </section>
  );
}

const scheduleDraft = z.object({
  choice: z.enum(SCHEDULE_CHOICES),
  otherDay: z.string(),
  note: z.string(),
});

/** The day a choice stands for, from today; the date picked for “Pick a date”. */
const scheduledDay = (draft: z.infer<typeof scheduleDraft>, today: string) =>
  draft.choice === 'other' ? draft.otherDay : addDays(today, Number(draft.choice));

/**
 * Schedule a follow-up, or Edit the follow-up when there is one (spec UX §6.5): its day (tomorrow,
 * +3 d, +7 d, +14 d or a date), an optional note, the summary; `Enter` validates, then “Undo”.
 */
function ScheduleFollowUpPanel({
  contact,
  summary,
  onClose,
}: {
  contact: SummaryContact;
  summary: Summary;
  onClose: () => void;
}) {
  const locale = useLocale();
  const api = useApi();
  const sendGesture = useSendGesture();
  const today = todayOf(summary);
  const { followUp, name } = contact;
  const [draft, setDraft, clearDraft] = useSessionDraft(
    `schedule-follow-up:${contact.id}`,
    followUp === null
      ? { choice: '3' as const, otherDay: '', note: '' }
      : { choice: 'other' as const, otherDay: followUp.dueOn, note: followUp.note ?? '' },
    scheduleDraft,
  );
  const dueOn = scheduledDay(draft, today);
  const isDayValid = /^\d{4}-\d{2}-\d{2}$/u.test(dueOn) && dueOn >= today;
  const close = () => {
    clearDraft();
    onClose();
  };
  const schedule = useMutation({
    mutationFn: () => {
      const date = formatLocalDay(dueOn, locale);
      return sendGesture(
        api.contacts[':id']['schedule-follow-up'].$post({
          param: { id: contact.id },
          json: { dueOn, ...trimmed(draft.note) },
        }),
        ({ contacts: [changed] }) => changed && m.follow_up_scheduled_toast({ name, date }),
      );
    },
    onSuccess: (refused) => {
      if (!refused) close();
    },
  });
  return (
    <GesturePanel
      title={
        followUp === null ? m.schedule_follow_up_title({ name }) : m.edit_follow_up_title({ name })
      }
      onClose={close}
    >
      <EnterSubmits>
        {(formRef) => (
          <Form
            ref={formRef}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (isDayValid && !schedule.isPending) schedule.mutate();
            }}
          >
            <GesturePanelBody>
              <SegmentedControl
                value={draft.choice}
                onChange={(value) => {
                  const choice = SCHEDULE_CHOICES.find((candidate) => candidate === value);
                  if (choice) setDraft({ ...draft, choice });
                }}
              >
                <Label>{m.follow_up_day()}</Label>
                <SegmentedControlItems className="flex-wrap">
                  {SCHEDULE_CHOICES.map((choice) => (
                    <SegmentedControlItem key={choice} value={choice}>
                      {dayLabel(choice)}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControlItems>
              </SegmentedControl>
              {draft.choice === 'other' && (
                <DayField
                  value={draft.otherDay}
                  onChange={(otherDay) => setDraft({ ...draft, otherDay })}
                  min={today}
                  error={m.follow_up_day_not_past()}
                />
              )}
              <NoteField value={draft.note} onChange={(note) => setDraft({ ...draft, note })} />
              {isDayValid && (
                <Recap
                  lines={[
                    // Edited, it keeps its rank (CONTEXT.md, Follow-up).
                    followUp?.rank == null
                      ? m.schedule_follow_up_recap({ date: formatLocalDay(dueOn, locale) })
                      : m.schedule_follow_up_recap_rank({
                          rank: followUp.rank,
                          date: formatLocalDay(dueOn, locale),
                        }),
                  ]}
                />
              )}
              <ErrorMessage>
                {schedule.isError ? m.auth_error() : refusalText(schedule.data)}
              </ErrorMessage>
            </GesturePanelBody>
            <GesturePanelFooter>
              <Button
                type="submit"
                className="max-md:min-h-11"
                isDisabled={!isDayValid || schedule.isPending}
              >
                {followUp === null ? m.schedule_follow_up_validate() : m.edit_follow_up_validate()}
              </Button>
            </GesturePanelFooter>
          </Form>
        )}
      </EnterSubmits>
    </GesturePanel>
  );
}

/** The day an Interaction was done on, as a panel keeps it. */
export const doneDayDraft = { choice: z.enum(DONE_CHOICES), otherDay: z.string() };
type DoneDayDraft = { choice: (typeof DONE_CHOICES)[number]; otherDay: string };

const doneDraft = z.object({ ...doneDayDraft, note: z.string() });

/** The local day chosen, and whether it is one: today or earlier. */
export function doneDayOf(draft: DoneDayDraft, today: string) {
  let day = draft.otherDay;
  if (draft.choice === 'today') day = today;
  if (draft.choice === 'yesterday') day = addDays(today, -1);
  return { day, isValid: /^\d{4}-\d{2}-\d{2}$/u.test(day) && day <= today };
}

/** Today, yesterday or a date before (spec UX §6.3): the day an Interaction was done on. */
export function DoneDayField({
  draft,
  onChange,
  today,
}: {
  draft: DoneDayDraft;
  onChange: (draft: DoneDayDraft) => void;
  today: string;
}) {
  return (
    <>
      <SegmentedControl
        value={draft.choice}
        onChange={(value) => {
          const choice = DONE_CHOICES.find((candidate) => candidate === value);
          if (choice) onChange({ ...draft, choice });
        }}
      >
        <Label>{m.follow_up_day()}</Label>
        <SegmentedControlItems className="flex-wrap">
          {DONE_CHOICES.map((choice) => (
            <SegmentedControlItem key={choice} value={choice}>
              {choice === 'today'
                ? m.follow_up_due_today()
                : choice === 'yesterday'
                  ? m.follow_up_yesterday()
                  : m.follow_up_other_day()}
            </SegmentedControlItem>
          ))}
        </SegmentedControlItems>
      </SegmentedControl>
      {draft.choice === 'other' && (
        <DayField
          value={draft.otherDay}
          onChange={(otherDay) => onChange({ ...draft, otherDay })}
          max={today}
          error={m.follow_up_day_not_future()}
        />
      )}
    </>
  );
}

/**
 * Follow up… (spec UX §6.3): what to send (off the Cadence, the note of the Follow-up and the last
 * outbound Interaction), then the day it was done and its note, and the summary: +1 to the Activity.
 * `Enter` validates, then “Undo”. No “Done” in one click.
 */
function FollowUpPanel({
  contact,
  summary,
  onClose,
}: {
  contact: SummaryContact;
  summary: Summary;
  onClose: () => void;
}) {
  const locale = useLocale();
  const api = useApi();
  const sendGesture = useSendGesture();
  const sendHeadingId = useId();
  const confirmHeadingId = useId();
  const today = todayOf(summary);
  const { followUp, name } = contact;
  const { data: record } = useQuery(contactRecordQuery(api, contact.id));
  const lastOutbound = record?.thread.find(({ direction }) => direction === 'outbound');
  const [draft, setDraft, clearDraft] = useSessionDraft(
    `follow-up:${contact.id}`,
    { choice: 'today' as const, otherDay: '', note: followUp?.note ?? '' },
    doneDraft,
  );
  const { day: occurredOn, isValid: isDayValid } = doneDayOf(draft, today);
  const activityGoal = settingsOf(summary).activityGoal.inEffect;
  const count = activityOn(summary.contacts, today) + 1;
  const close = () => {
    clearDraft();
    onClose();
  };
  /** What the notification says: the Activity of today, or the day it was done. */
  const doneMessage = () => {
    if (occurredOn !== today) {
      return m.followed_up_toast_past({ name, date: formatLocalDay(occurredOn, locale) });
    }
    return activityGoal === null
      ? m.followed_up_toast_no_goal({ name, count })
      : m.followed_up_toast({ name, count, goal: activityGoal });
  };
  const done = useMutation({
    mutationFn: () =>
      sendGesture(
        api.contacts[':id']['follow-up'].$post({
          param: { id: contact.id },
          json: { occurredOn, ...trimmed(draft.note) },
        }),
        ({ contacts: [changed] }) => changed && doneMessage(),
      ),
    onSuccess: (refused) => {
      if (!refused) close();
    },
  });
  // Another device did it, or canceled it, meanwhile: nothing left to do.
  if (followUp === null) return null;
  return (
    <GesturePanel title={m.follow_up_title({ name })} onClose={close}>
      <EnterSubmits>
        {(formRef) => (
          <Form
            ref={formRef}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (isDayValid && !done.isPending) done.mutate();
            }}
          >
            <GesturePanelBody>
              <section aria-labelledby={sendHeadingId} className="flex flex-col gap-1.5">
                <h3
                  id={sendHeadingId}
                  className="text-xs font-semibold text-muted-foreground uppercase"
                >
                  {m.follow_up_send_it()}
                </h3>
                <p>
                  {followUp.note === null
                    ? m.follow_up_no_note()
                    : m.follow_up_why({ note: followUp.note })}
                </p>
                {record && (
                  <p className="text-muted-foreground">
                    {lastOutbound
                      ? [
                          m.follow_up_last_outbound({
                            date: formatLocalDay(lastOutbound.localDate, locale),
                          }),
                          lastOutbound.note,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : m.follow_up_no_outbound()}
                  </p>
                )}
              </section>
              <section aria-labelledby={confirmHeadingId} className="flex flex-col gap-4">
                <h3
                  id={confirmHeadingId}
                  className="text-xs font-semibold text-muted-foreground uppercase"
                >
                  {m.follow_up_confirm()}
                </h3>
                <DoneDayField
                  draft={draft}
                  onChange={(day) => setDraft({ ...draft, ...day })}
                  today={today}
                />
                <NoteField
                  value={draft.note}
                  onChange={(note) => setDraft({ ...draft, note })}
                  takesFocus
                />
                {isDayValid && (
                  <Recap lines={[activityRecap(occurredOn, today, count, activityGoal, locale)]} />
                )}
              </section>
              <ErrorMessage>{done.isError ? m.auth_error() : refusalText(done.data)}</ErrorMessage>
            </GesturePanelBody>
            <GesturePanelFooter>
              <Button
                type="submit"
                className="max-md:min-h-11"
                isDisabled={!isDayValid || done.isPending}
              >
                {m.action_follow_up()}
              </Button>
            </GesturePanelFooter>
          </Form>
        )}
      </EnterSubmits>
    </GesturePanel>
  );
}

/** What a Prospecting action adds to the Activity: today's count against its goal, or the day it was done. */
export function activityRecap(
  day: string,
  today: string,
  count: number,
  goal: number | null,
  locale: Locale,
) {
  if (day !== today) return m.follow_up_activity_recap_past({ date: formatLocalDay(day, locale) });
  return goal === null
    ? m.follow_up_activity_recap_no_goal({ count })
    : m.follow_up_activity_recap({ count, goal });
}

/** The gesture on a Follow-up open on a record, if any: one panel or the other. */
export function FollowUpPanels({
  contact,
  summary,
  gesture,
  onClose,
}: {
  contact: SummaryContact;
  summary: Summary;
  gesture: FollowUpGesture | undefined;
  onClose: () => void;
}) {
  // None for a Contact that cannot have one, from an address kept from before.
  if (gesture === undefined || !hasFollowUps(contact.status)) return null;
  return gesture === 'do' ? (
    <FollowUpPanel key={contact.id} contact={contact} summary={summary} onClose={onClose} />
  ) : (
    <ScheduleFollowUpPanel key={contact.id} contact={contact} summary={summary} onClose={onClose} />
  );
}

/** `Enter` validates from any field but a text one (spec UX §3.3): a choice of day would not submit by itself. */
export function EnterSubmits({
  children,
}: {
  children: (formRef: React.RefObject<HTMLFormElement | null>) => React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- `Enter` validates from any field (spec UX §3.3).
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || event.target instanceof HTMLButtonElement) return;
        if (event.target instanceof HTMLTextAreaElement) return;
        event.preventDefault();
        formRef.current?.requestSubmit();
      }}
    >
      {children(formRef)}
    </div>
  );
}

/** A local day picked by the User, within a bound. */
export function DayField({
  value,
  onChange,
  min,
  max,
  error,
  label = m.follow_up_pick_day(),
}: {
  value: string;
  onChange: (day: string) => void;
  min?: string;
  max?: string;
  error: string;
  label?: string;
}) {
  const isInvalid =
    value !== '' && ((min !== undefined && value < min) || (max !== undefined && value > max));
  return (
    <TextField
      value={value}
      onChange={onChange}
      isInvalid={isInvalid}
      className="flex flex-col gap-1.5"
    >
      <Label>{label}</Label>
      {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- “Pick a date” was just chosen: its field takes the focus. */}
      <Input type="date" min={min} max={max} autoFocus className="max-md:h-11" />
      <FieldErrorMessage>{error}</FieldErrorMessage>
    </TextField>
  );
}

/** The optional note of a Follow-up, which stays on its Interaction once done, or of an Interaction. */
export function NoteField({
  value,
  onChange,
  takesFocus = false,
  maxLength = FOLLOW_UP_NOTE_MAX_LENGTH,
}: {
  value: string;
  onChange: (note: string) => void;
  takesFocus?: boolean;
  maxLength?: number;
}) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      className="flex flex-col gap-1.5"
    >
      <Label>{m.follow_up_note()}</Label>
      {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- the panel was just opened: its field takes the focus, which closing gives back. */}
      <Input autoFocus={takesFocus} className="max-md:h-11" />
    </TextField>
  );
}

/** The summary of what a gesture does (spec UX §1). */
export const Recap = ({ lines }: { lines: string[] }) => (
  <section aria-label={m.change_status_recap()} className="rounded-control border p-3">
    <ul className="list-disc pl-5">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  </section>
);
