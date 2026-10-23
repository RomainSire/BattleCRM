import { CHECK_IN_CHANNELS, INTERACTION_NOTE_MAX_LENGTH } from '@battlecrm/contract';
import { activityOn, isFollowUpDue } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useMutation } from '@tanstack/react-query';
import { Form } from 'react-aria-components';
import { z } from 'zod';

import { CHECK_IN_CHANNEL_LABEL } from '../channel.ts';
import { nextCheckInOf } from '../circle/ally-signal.ts';
import { Button } from '../components/ui/button.tsx';
import { Checkbox } from '../components/ui/checkbox.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import {
  GesturePanel,
  GesturePanelBody,
  GesturePanelFooter,
} from '../components/ui/gesture-panel.tsx';
import { Label } from '../components/ui/label.tsx';
import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '../components/ui/segmented-control.tsx';
import { useSendGesture, type RefusalOf } from '../gesture.ts';
import { useLocale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';
import { useSessionDraft } from '../session-draft.ts';
import { settingsOf } from '../settings/use-settings.ts';
import { todayOf, type Summary, type SummaryContact } from '../summary.ts';
import {
  activityRecap,
  doneDayDraft,
  doneDayOf,
  DoneDayField,
  EnterSubmits,
  NoteField,
  Recap,
  trimmed,
} from './follow-up.tsx';
import { formatLocalDay } from './format.ts';

/** What becomes of the Follow-up to come: kept, by default, or canceled (spec UX §6.14). */
const FOLLOW_UP_CHOICES = ['keep', 'cancel'] as const;

const checkInDraft = z.object({
  ...doneDayDraft,
  channel: z.enum(CHECK_IN_CHANNELS),
  note: z.string(),
  followUp: z.enum(FOLLOW_UP_CHOICES),
  scheduleFollowUp: z.boolean(),
});

type CheckInRefusal = RefusalOf<ApiClient['contacts'][':id']['check-in']['$post']>;

/** The panel's own refusal, a day, then an Ally changed elsewhere. */
const refusalText = (refused: CheckInRefusal | undefined) =>
  refused !== undefined &&
  (refused.error === 'future_day' ? m.follow_up_day_not_future() : m.follow_up_behind());

/**
 * Check in… (spec UX §6.14), on an Ally only: how it was done, the day and a note; a Prospecting
 * action, which brings the Days since contact back to 0. A Follow-up to come is kept by default, or
 * canceled; it is never consumed. “Schedule a follow-up…” follows once it is saved.
 */
export function CheckInPanel({
  contact,
  summary,
  onClose,
  onScheduleFollowUp,
}: {
  contact: SummaryContact;
  summary: Summary;
  onClose: () => void;
  onScheduleFollowUp: () => void;
}) {
  const locale = useLocale();
  const api = useApi();
  const sendGesture = useSendGesture();
  const today = todayOf(summary);
  const { name } = contact;
  const [draft, setDraft, clearDraft] = useSessionDraft(
    `check-in:${contact.id}`,
    {
      choice: 'today' as const,
      otherDay: '',
      channel: 'email' as const,
      note: '',
      followUp: 'keep' as const,
      scheduleFollowUp: false,
    },
    checkInDraft,
  );
  const { day: occurredOn, isValid: isDayValid } = doneDayOf(draft, today);
  // A Follow-up due is followed up instead (spec UX §6.14); only one to come is offered here.
  const upcoming =
    contact.followUp !== null && !isFollowUpDue(contact.followUp.dueOn, today)
      ? contact.followUp
      : null;
  const cancelsFollowUp = upcoming !== null && draft.followUp === 'cancel';
  // One Follow-up at most: none to schedule while one stays, due or to come.
  const mayScheduleFollowUp = contact.followUp === null || cancelsFollowUp;
  // The Days since contact count from the latest Interaction done: this one, unless a later one was.
  const { lastDoneInteractionOn: before } = contact;
  const lastDoneOn = before !== null && before > occurredOn ? before : occurredOn;
  // A Follow-up kept before the Rhythm is what calls the Ally back first.
  const keptOn = upcoming && !cancelsFollowUp ? upcoming.dueOn : undefined;
  const nextOn = formatLocalDay(nextCheckInOf(summary, lastDoneOn, today, keptOn), locale);
  const activityGoal = settingsOf(summary).activityGoal.inEffect;
  const count = activityOn(summary.contacts, today) + 1;
  const close = () => {
    clearDraft();
    onClose();
  };
  const checkIn = useMutation({
    mutationFn: () =>
      sendGesture(
        api.contacts[':id']['check-in'].$post({
          param: { id: contact.id },
          json: {
            channel: draft.channel,
            occurredOn,
            ...trimmed(draft.note),
            ...(cancelsFollowUp && { cancelFollowUp: true }),
          },
        }),
        ({ contacts: [changed] }) => changed && m.check_in_toast({ name, date: nextOn }),
      ),
    onSuccess: (refused) => {
      if (refused) return;
      clearDraft();
      if (mayScheduleFollowUp && draft.scheduleFollowUp) onScheduleFollowUp();
      else onClose();
    },
  });
  const recap = [activityRecap(occurredOn, today, count, activityGoal, locale)];
  recap.push(
    lastDoneOn === today
      ? m.check_in_recap({ date: nextOn })
      : m.check_in_recap_since({ since: formatLocalDay(lastDoneOn, locale), date: nextOn }),
  );
  if (cancelsFollowUp) {
    recap.push(m.change_status_cancels_follow_up({ date: formatLocalDay(upcoming.dueOn, locale) }));
  }
  return (
    <GesturePanel title={m.check_in_title({ name })} onClose={close}>
      <EnterSubmits>
        {(formRef) => (
          <Form
            ref={formRef}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (isDayValid && !checkIn.isPending) checkIn.mutate();
            }}
          >
            <GesturePanelBody>
              <SegmentedControl
                value={draft.channel}
                onChange={(value) => {
                  const channel = CHECK_IN_CHANNELS.find((candidate) => candidate === value);
                  if (channel) setDraft({ ...draft, channel });
                }}
              >
                <Label>{m.check_in_channel()}</Label>
                <SegmentedControlItems className="flex-wrap">
                  {CHECK_IN_CHANNELS.map((channel) => (
                    <SegmentedControlItem key={channel} value={channel}>
                      {CHECK_IN_CHANNEL_LABEL[channel]()}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControlItems>
              </SegmentedControl>
              <DoneDayField
                draft={draft}
                onChange={(day) => setDraft({ ...draft, ...day })}
                today={today}
              />
              <NoteField
                value={draft.note}
                onChange={(text) => setDraft({ ...draft, note: text })}
                maxLength={INTERACTION_NOTE_MAX_LENGTH}
                takesFocus
              />
              {upcoming && (
                <SegmentedControl
                  value={draft.followUp}
                  onChange={(value) => {
                    const chosen = FOLLOW_UP_CHOICES.find((candidate) => candidate === value);
                    if (chosen) setDraft({ ...draft, followUp: chosen });
                  }}
                >
                  <Label>{m.check_in_follow_up()}</Label>
                  <SegmentedControlItems className="flex-wrap">
                    <SegmentedControlItem value="keep">
                      {m.check_in_keep_follow_up({
                        date: formatLocalDay(upcoming.dueOn, locale),
                      })}
                    </SegmentedControlItem>
                    <SegmentedControlItem value="cancel">
                      {m.check_in_cancel_follow_up()}
                    </SegmentedControlItem>
                  </SegmentedControlItems>
                </SegmentedControl>
              )}
              {mayScheduleFollowUp && (
                <Checkbox
                  isSelected={draft.scheduleFollowUp}
                  onChange={(scheduleFollowUp) => setDraft({ ...draft, scheduleFollowUp })}
                  className="max-md:min-h-11"
                >
                  {m.reply_schedule_follow_up()}
                </Checkbox>
              )}
              {isDayValid && <Recap lines={recap} />}
              <ErrorMessage>
                {checkIn.isError ? m.auth_error() : refusalText(checkIn.data)}
              </ErrorMessage>
            </GesturePanelBody>
            <GesturePanelFooter>
              <Button
                type="submit"
                className="max-md:min-h-11"
                isDisabled={!isDayValid || checkIn.isPending}
              >
                {m.check_in_validate()}
              </Button>
            </GesturePanelFooter>
          </Form>
        )}
      </EnterSubmits>
    </GesturePanel>
  );
}
