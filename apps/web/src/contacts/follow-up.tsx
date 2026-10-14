import { FOLLOW_UP_NOTE_MAX_LENGTH } from '@battlecrm/contract';
import { activityOn, addDays, followUpSignal, localDay } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useLocale, type Locale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';
import { useSessionDraft } from '../session-draft.ts';
import { settingsOf } from '../settings/use-settings.ts';
import {
  applySummaryChanges,
  SUMMARY_KEY,
  type Summary,
  type SummaryChanges,
  type SummaryContact,
} from '../summary.ts';
import { notifyGesture } from '../undo.tsx';
import { contactRecordQuery } from './contact-record-query.ts';
import { formatLocalDay } from './format.ts';
import type { FollowUpGesture } from './status.ts';

/** Today for the User, in its time zone: what a Follow-up is due on, the Activity and the Funnel entries counted on. */
export const todayOf = (summary: Summary) => localDay(new Date(), summary.timeZone);

/** Only a Contact Prospecting and an Ally have a Follow-up (CONTEXT.md, Follow-up). */
export const hasFollowUps = ({ status }: SummaryContact) =>
  status === 'prospecting' || status === 'ally';

/** Whether its scheduled Follow-up is due: today, or overdue. */
export const isFollowUpDue = (contact: SummaryContact, today: string) =>
  contact.followUp !== null && followUpSignal(contact.followUp.dueOn, today) !== 'upcoming';

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

/** What a gesture on a Follow-up answers: its changes, a day the server refuses, or a Contact this device is behind on. */
type Answer = { changes: SummaryChanges; undoToken: string } | 'bad_day' | 'behind';

/** A refusal of the server: a day it refuses is the panel's to show; anything else, a Contact changed elsewhere. */
async function refusalOf(response: {
  status: number;
  json(): Promise<unknown>;
}): Promise<'bad_day' | 'behind' | undefined> {
  if (response.status !== 400 && response.status !== 404 && response.status !== 409)
    return undefined;
  const { error } = z.object({ error: z.string() }).parse(await response.json());
  if (error === 'past_day' || error === 'future_day') return 'bad_day';
  // A body the server would not read is this app's error, never the User's.
  if (error === 'invalid') throw new Error('A Follow-up gesture was refused as invalid');
  return 'behind';
}

/** The three gestures of a Follow-up, as the SPA sends them. */
const send = {
  async schedule(
    api: ApiClient,
    contactId: string,
    json: { dueOn: string; note?: string },
  ): Promise<Answer> {
    const response = await api.contacts[':id']['schedule-follow-up'].$post({
      param: { id: contactId },
      json,
    });
    const refused = await refusalOf(response);
    if (refused) return refused;
    if (!response.ok) throw new Error('POST /api/contacts/:id/schedule-follow-up failed');
    return response.json();
  },
  async cancel(api: ApiClient, contactId: string): Promise<Answer> {
    const response = await api.contacts[':id']['cancel-follow-up'].$post({
      param: { id: contactId },
    });
    const refused = await refusalOf(response);
    if (refused) return refused;
    if (!response.ok) throw new Error('POST /api/contacts/:id/cancel-follow-up failed');
    return response.json();
  },
  async followUp(
    api: ApiClient,
    contactId: string,
    json: { occurredOn: string; note?: string },
  ): Promise<Answer> {
    const response = await api.contacts[':id']['follow-up'].$post({
      param: { id: contactId },
      json,
    });
    const refused = await refusalOf(response);
    if (refused) return refused;
    if (!response.ok) throw new Error('POST /api/contacts/:id/follow-up failed');
    return response.json();
  },
};

/**
 * Applies the answer of a gesture and says what was done, with “Undo”; `false` when the server
 * refused the day, or the Contact changed elsewhere: the summary is then read again.
 */
async function settle(
  queryClient: ReturnType<typeof useQueryClient>,
  answer: Answer,
  message: (changed: SummaryContact) => string,
): Promise<boolean> {
  if (typeof answer === 'string') {
    await queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
    return false;
  }
  await applySummaryChanges(queryClient, answer.changes);
  const [changed] = answer.changes.contacts;
  if (changed) notifyGesture(message(changed), answer.undoToken);
  return true;
}

const trimmed = (note: string) => {
  const text = note.trim();
  return text === '' ? {} : { note: text };
};

/** The days a Follow-up is postponed by, from today (spec UX §5.3). */
const POSTPONE_DAYS = [1, 3, 7] as const;

/** The quick days of “Schedule a follow-up” (spec UX §6.5), then any date. */
const SCHEDULE_CHOICES = ['1', '3', '7', '14', 'other'] as const;
/** The day “Follow up…” was done on (spec UX §6.3): today, yesterday, or any date before. */
const DONE_CHOICES = ['today', 'yesterday', 'other'] as const;

const dayLabel = (choice: (typeof SCHEDULE_CHOICES)[number]) => {
  if (choice === 'other') return m.follow_up_other_day();
  if (choice === '1') return m.follow_up_tomorrow();
  return m.follow_up_in_days({ days: Number(choice) });
};

/**
 * The head of the thread (spec UX §5.3): the scheduled Follow-up as what comes next, off the Cadence,
 * with its signal and note, and Follow up… / Edit / Postpone / Cancel; or, without one, the reminder
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
  const queryClient = useQueryClient();
  const headingId = useId();
  const today = todayOf(summary);
  const { name } = contact;
  const postpone = useMutation({
    mutationFn: (days: number) =>
      send.schedule(api, contact.id, {
        dueOn: addDays(today, days),
        ...trimmed(contact.followUp?.note ?? ''),
      }),
    onSuccess: async (answer, days) => {
      const date = formatLocalDay(addDays(today, days), locale);
      if (!(await settle(queryClient, answer, () => m.follow_up_scheduled_toast({ name, date })))) {
        notify({ message: m.follow_up_behind(), isError: true });
      }
    },
    onError: () => notify({ message: m.auth_error(), isError: true }),
  });
  const cancel = useMutation({
    mutationFn: () => send.cancel(api, contact.id),
    onSuccess: async (answer) => {
      if (!(await settle(queryClient, answer, () => m.follow_up_canceled_toast({ name })))) {
        notify({ message: m.follow_up_behind(), isError: true });
      }
    },
    onError: () => notify({ message: m.auth_error(), isError: true }),
  });
  if (!hasFollowUps(contact)) return null;
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
          {m.follow_up_off_cadence()}
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
  const queryClient = useQueryClient();
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
    mutationFn: () => send.schedule(api, contact.id, { dueOn, ...trimmed(draft.note) }),
    onSuccess: async (answer) => {
      const date = formatLocalDay(dueOn, locale);
      if (await settle(queryClient, answer, () => m.follow_up_scheduled_toast({ name, date }))) {
        close();
      }
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
                  lines={[m.schedule_follow_up_recap({ date: formatLocalDay(dueOn, locale) })]}
                />
              )}
              <ErrorMessage>
                {schedule.isError
                  ? m.auth_error()
                  : (schedule.data === 'bad_day' && m.follow_up_day_not_past()) ||
                    (schedule.data === 'behind' && m.follow_up_behind())}
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

const doneDraft = z.object({
  choice: z.enum(DONE_CHOICES),
  otherDay: z.string(),
  note: z.string(),
});

const doneDay = (draft: z.infer<typeof doneDraft>, today: string) => {
  if (draft.choice === 'today') return today;
  return draft.choice === 'yesterday' ? addDays(today, -1) : draft.otherDay;
};

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
  const queryClient = useQueryClient();
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
  const occurredOn = doneDay(draft, today);
  const isDayValid = /^\d{4}-\d{2}-\d{2}$/u.test(occurredOn) && occurredOn <= today;
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
    mutationFn: () => send.followUp(api, contact.id, { occurredOn, ...trimmed(draft.note) }),
    onSuccess: async (answer) => {
      if (await settle(queryClient, answer, doneMessage)) close();
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
                <SegmentedControl
                  value={draft.choice}
                  onChange={(value) => {
                    const choice = DONE_CHOICES.find((candidate) => candidate === value);
                    if (choice) setDraft({ ...draft, choice });
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
                    onChange={(otherDay) => setDraft({ ...draft, otherDay })}
                    max={today}
                    error={m.follow_up_day_not_future()}
                  />
                )}
                <NoteField
                  value={draft.note}
                  onChange={(note) => setDraft({ ...draft, note })}
                  takesFocus
                />
                {isDayValid && (
                  <Recap lines={[activityRecap(occurredOn, today, count, activityGoal, locale)]} />
                )}
              </section>
              <ErrorMessage>
                {done.isError
                  ? m.auth_error()
                  : (done.data === 'bad_day' && m.follow_up_day_not_future()) ||
                    (done.data === 'behind' && m.follow_up_behind())}
              </ErrorMessage>
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

/** What “Follow up…” adds to the Activity: today's count against its goal, or the day it was done. */
function activityRecap(
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
  if (gesture === undefined || !hasFollowUps(contact)) return null;
  return gesture === 'do' ? (
    <FollowUpPanel key={contact.id} contact={contact} summary={summary} onClose={onClose} />
  ) : (
    <ScheduleFollowUpPanel key={contact.id} contact={contact} summary={summary} onClose={onClose} />
  );
}

/** `Enter` validates from any field but a text one (spec UX §3.3): a choice of day would not submit by itself. */
function EnterSubmits({
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
function DayField({
  value,
  onChange,
  min,
  max,
  error,
}: {
  value: string;
  onChange: (day: string) => void;
  min?: string;
  max?: string;
  error: string;
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
      <Label>{m.follow_up_pick_day()}</Label>
      {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- “Pick a date” was just chosen: its field takes the focus. */}
      <Input type="date" min={min} max={max} autoFocus className="max-md:h-11" />
      <FieldErrorMessage>{error}</FieldErrorMessage>
    </TextField>
  );
}

/** The optional note of a Follow-up, which stays on its Interaction once done. */
function NoteField({
  value,
  onChange,
  takesFocus = false,
}: {
  value: string;
  onChange: (note: string) => void;
  takesFocus?: boolean;
}) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      maxLength={FOLLOW_UP_NOTE_MAX_LENGTH}
      className="flex flex-col gap-1.5"
    >
      <Label>{m.follow_up_note()}</Label>
      {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- the panel was just opened: its field takes the focus, which closing gives back. */}
      <Input autoFocus={takesFocus} className="max-md:h-11" />
    </TextField>
  );
}

/** The summary of what a gesture does (spec UX §1). */
const Recap = ({ lines }: { lines: string[] }) => (
  <section aria-label={m.change_status_recap()} className="rounded-control border p-3">
    <ul className="list-disc pl-5">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  </section>
);
