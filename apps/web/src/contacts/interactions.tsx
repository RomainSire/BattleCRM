import {
  CHANNELS,
  INTERACTION_NOTE_MAX_LENGTH,
  NOTED_INTERACTION_KINDS,
  REPLY_TRIAL_OUTCOMES,
  type NotedInteractionKind,
} from '@battlecrm/contract';
import {
  canNoteInteraction,
  funnelOf,
  hasFollowUps,
  isPoolOrArchived,
  responseWindowEndsOn,
  stageToEnter,
  statusChangeCancelsFollowUp,
} from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { Form } from 'react-aria-components';
import { z } from 'zod';

import { CHANNEL_LABEL } from '../channel.ts';
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
import { todayOf, type Summary, type SummaryContact } from '../summary.ts';
import { pushedFollowUpOn } from './cadence.ts';
import { StageField, statusChangedMessage, statusRecap } from './change-status.tsx';
import { contactRecordQuery } from './contact-record-query.ts';
import {
  doneDayDraft,
  doneDayOf,
  DoneDayField,
  EnterSubmits,
  NoteField,
  Recap,
  trimmed,
} from './follow-up.tsx';
import { formatLocalDay } from './format.ts';
import type { FollowUpGesture, InteractionGesture } from './status.ts';
import {
  NO_RESULT_CHOICES,
  NoResultChoiceField,
  trialRecap,
  TrialOutcomeField,
  TrialRecall,
  trialSettledMessage,
  trialStateOf,
} from './trial.tsx';

/**
 * The gesture that records an Interaction open on the record, carried by the address (ST-70): `open`
 * shows its panel, `close` takes it away, `chain` gives way to a gesture on the Follow-up.
 */
export function useInteractionGesture() {
  const { interaction } = useSearch({ strict: false });
  const navigate = useNavigate();
  return {
    gesture: interaction,
    open: (gesture: InteractionGesture) =>
      void navigate({ to: '.', search: (search) => ({ ...search, interaction: gesture }) }),
    close: () =>
      void navigate({
        to: '.',
        search: ({ interaction: _closed, ...search }) => search,
        replace: true,
      }),
    chain: (followUp: FollowUpGesture) =>
      void navigate({
        to: '.',
        search: ({ interaction: _closed, ...search }) => ({ ...search, followUp }),
        replace: true,
      }),
  };
}

const KIND_LABEL: Record<NotedInteractionKind, () => string> = {
  call: m.interaction_kind_call,
  meeting: m.interaction_kind_meeting,
  message: m.interaction_kind_message,
  other: m.interaction_kind_other,
};

/** A refusal of a gesture recording an Interaction. */
type InteractionRefusal =
  | RefusalOf<ApiClient['contacts'][':id']['note-interaction']['$post']>
  | RefusalOf<ApiClient['contacts'][':id']['record-reply']['$post']>;

/** A Stage the server refuses has to be chosen again. */
const isStageGone = (refused: InteractionRefusal) =>
  refused.error === 'stage_required' || refused.error === 'unknown_stage';

/** The panel's own refusals, a day or a Stage, then a Contact changed elsewhere. */
function refusalText(refused: InteractionRefusal | undefined) {
  if (refused === undefined) return false;
  if (refused.error === 'future_day') return m.follow_up_day_not_future();
  if (isStageGone(refused)) return m.contact_stage_gone();
  return m.follow_up_behind();
}

const noteDraft = z.object({
  ...doneDayDraft,
  kind: z.enum(NOTED_INTERACTION_KINDS),
  note: z.string(),
});

/**
 * Note an Interaction (spec UX §6.4): an outbound Interaction off any Positioning, its kind, the day
 * and a note, off the Activity. Whatever came in goes through “Replied…”, which a link opens.
 */
function NoteInteractionPanel({
  contact,
  summary,
  onClose,
  onReply,
}: {
  contact: SummaryContact;
  summary: Summary;
  onClose: () => void;
  onReply: () => void;
}) {
  const locale = useLocale();
  const api = useApi();
  const sendGesture = useSendGesture();
  const today = todayOf(summary);
  const { name } = contact;
  const [draft, setDraft, clearDraft] = useSessionDraft(
    `note-interaction:${contact.id}`,
    { choice: 'today' as const, otherDay: '', kind: 'call' as const, note: '' },
    noteDraft,
  );
  const { day: occurredOn, isValid: isDayValid } = doneDayOf(draft, today);
  const { data: record } = useQuery(contactRecordQuery(api, contact.id));
  // It pushes the Follow-up of the Cadence back (spec UX §6.4).
  const pushedOn =
    isDayValid && record
      ? pushedFollowUpOn(contact.followUp, record.thread, summary, occurredOn)
      : undefined;
  const close = () => {
    clearDraft();
    onClose();
  };
  const note = useMutation({
    mutationFn: () =>
      sendGesture(
        api.contacts[':id']['note-interaction'].$post({
          param: { id: contact.id },
          json: { kind: draft.kind, occurredOn, ...trimmed(draft.note) },
        }),
        ({ contacts: [changed] }) => changed && m.note_interaction_toast({ name }),
      ),
    onSuccess: (refused) => {
      if (!refused) close();
    },
  });
  return (
    <GesturePanel title={m.note_interaction_title({ name })} onClose={close}>
      <EnterSubmits>
        {(formRef) => (
          <Form
            ref={formRef}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (isDayValid && !note.isPending) note.mutate();
            }}
          >
            <GesturePanelBody>
              <SegmentedControl
                value={draft.kind}
                onChange={(value) => {
                  const kind = NOTED_INTERACTION_KINDS.find((candidate) => candidate === value);
                  if (kind) setDraft({ ...draft, kind });
                }}
              >
                <Label>{m.note_interaction_kind()}</Label>
                <SegmentedControlItems className="flex-wrap">
                  {NOTED_INTERACTION_KINDS.map((kind) => (
                    <SegmentedControlItem key={kind} value={kind}>
                      {KIND_LABEL[kind]()}
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
              <p className="text-muted-foreground">
                {m.note_interaction_inbound_hint()}{' '}
                <Button
                  variant="link"
                  className="h-auto p-0 max-md:min-h-11"
                  onPress={() => {
                    clearDraft();
                    onReply();
                  }}
                >
                  {m.verb_reply()}
                </Button>
              </p>
              <Recap
                lines={[
                  m.note_interaction_off_activity(),
                  ...(pushedOn !== undefined && contact.followUp?.rank != null
                    ? [
                        m.note_interaction_pushes_follow_up({
                          rank: contact.followUp.rank,
                          date: formatLocalDay(pushedOn, locale),
                        }),
                      ]
                    : []),
                ]}
              />
              <ErrorMessage>{note.isError ? m.auth_error() : refusalText(note.data)}</ErrorMessage>
            </GesturePanelBody>
            <GesturePanelFooter>
              <Button
                type="submit"
                className="max-md:min-h-11"
                isDisabled={!isDayValid || note.isPending}
              >
                {m.note_interaction_validate()}
              </Button>
            </GesturePanelFooter>
          </Form>
        )}
      </EnterSubmits>
    </GesturePanel>
  );
}

/** What a spontaneous reply does to a Contact of the Pool or Archived (spec UX §6.2): nothing, by default. */
const REPLY_STATUSES = ['stay', 'prospecting', 'ally'] as const;

const replyDraft = z.object({
  ...doneDayDraft,
  channel: z.enum(CHANNELS),
  note: z.string(),
  status: z.enum(REPLY_STATUSES),
  stageId: z.string().optional(),
  cancelFollowUp: z.boolean(),
  scheduleFollowUp: z.boolean(),
  trialOutcome: z.enum(REPLY_TRIAL_OUTCOMES).optional(),
  afterNoResult: z.enum(NO_RESULT_CHOICES),
  reason: z.string(),
});

/**
 * Replied… (spec UX §6.2): the reply, its day, Channel and note, never a nature (ADR 0005); then what
 * comes next. From the Pool or Archived: leave it (by default), bring it in or add it to the Circle.
 * The scheduled Follow-up canceled (checked), or “Schedule a follow-up…” once recorded. With a Trial
 * in progress, its Criterion recalled and its outcome chosen, never preselected (ADR 0005): saved only
 * once it is; after a No result, back to the Pool by default (§6.7).
 */
function ReplyPanel({
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
  const theirReplyId = useId();
  const thenId = useId();
  const trialHeadingId = useId();
  const today = todayOf(summary);
  const { name, followUp } = contact;
  const isOut = isPoolOrArchived(contact.status);
  const [draft, setDraft, clearDraft] = useSessionDraft(
    `reply:${contact.id}`,
    {
      choice: 'today' as const,
      otherDay: '',
      channel: 'email' as const,
      note: '',
      status: 'stay' as const,
      stageId: stageToEnter(funnelOf(summary.stages), { last: contact.stageId }),
      cancelFollowUp: true,
      scheduleFollowUp: false,
      afterNoResult: 'pool' as const,
      reason: '',
    },
    replyDraft,
  );
  const trial = contact.status === 'prospecting' ? trialStateOf(contact, summary) : undefined;
  const trialOutcome = trial ? draft.trialOutcome : undefined;
  const isTrialUnsettled = trial !== undefined && trialOutcome === undefined;
  const afterNoResult =
    trialOutcome === 'no_result' && draft.afterNoResult !== 'prospecting'
      ? draft.afterNoResult
      : undefined;
  const [wasSent, setWasSent] = useState(false);
  const { day: occurredOn, isValid: isDayValid } = doneDayOf(draft, today);
  const status = isOut && draft.status !== 'stay' ? draft.status : afterNoResult;
  const stageId = stageToEnter(funnelOf(summary.stages), { chosen: draft.stageId });
  const isStageMissing = status === 'prospecting' && stageId === undefined;
  // Its scheduled Follow-up may be canceled; one may be scheduled once in a Status that has some.
  const cancelsFollowUp = followUp !== null && draft.cancelFollowUp;
  const statusAfter = status ?? contact.status;
  const mayScheduleFollowUp = hasFollowUps(statusAfter);
  const close = () => {
    clearDraft();
    onClose();
  };
  const reply = useMutation({
    mutationFn: () =>
      sendGesture(
        api.contacts[':id']['record-reply'].$post({
          param: { id: contact.id },
          json: {
            occurredOn,
            channel: draft.channel,
            ...trimmed(draft.note),
            ...(cancelsFollowUp && { cancelFollowUp: true }),
            ...(trialOutcome && { trialOutcome }),
            ...(status && { status }),
            ...(status === 'prospecting' && stageId !== undefined && { stageId }),
            ...(afterNoResult && draft.reason.trim() !== '' && { reason: draft.reason.trim() }),
          },
        }),
        (changes) => {
          const [changed] = changes.contacts;
          if (!changed) return undefined;
          const said = status
            ? statusChangedMessage(changed, status, summary)
            : m.reply_toast({ name });
          return trialSettledMessage(trialOutcome, trial, changes, said);
        },
      ),
    onSuccess: (refused) => {
      if (refused) {
        if (isStageGone(refused)) setDraft({ ...draft, stageId: undefined });
        return;
      }
      clearDraft();
      if (mayScheduleFollowUp && draft.scheduleFollowUp) onScheduleFollowUp();
      else onClose();
    },
  });

  const recap: string[] = [];
  if (trial && trialOutcome) {
    // Left in progress, its Response window counts from the reply, unless a Follow-up stays
    // scheduled (CONTEXT.md, Response window).
    const keepsFollowUp = followUp !== null && !cancelsFollowUp;
    const lastOn = trial.lastDoneOn > occurredOn ? trial.lastDoneOn : occurredOn;
    const endsOn = responseWindowEndsOn({
      followUp: keepsFollowUp ? followUp : null,
      lastDoneOn: lastOn,
      responseWindowDays: trial.positioning.responseWindowDays,
    });
    recap.push(trialRecap(trialOutcome, trial, isDayValid ? endsOn : undefined, locale));
  }
  // Canceled by the reply, or by the Status it leaves for.
  const isFollowUpCanceled =
    cancelsFollowUp || (afterNoResult !== undefined && statusChangeCancelsFollowUp(afterNoResult));
  if (followUp && isFollowUpCanceled) {
    recap.push(m.change_status_cancels_follow_up({ date: formatLocalDay(followUp.dueOn, locale) }));
  } else if (followUp?.rank != null) {
    // `!= null`, fallback: a summary kept on the device by a version from before ranks carries none.
    // The reply stops the Cadence: the Follow-up kept is off it (CONTEXT.md, Follow-up cadence).
    recap.push(m.reply_stops_cadence({ date: formatLocalDay(followUp.dueOn, locale) }));
  }
  // The Days since contact of an Ally count from its last Interaction done (CONTEXT.md): the reply,
  // unless a later one was done.
  const { lastDoneInteractionOn: before } = contact;
  const lastDoneOn = before !== null && before > occurredOn ? before : occurredOn;
  if (status)
    recap.push(...statusRecap(status, summary, locale, isDayValid ? lastDoneOn : undefined));
  if (isDayValid && lastDoneOn === occurredOn && statusAfter === 'ally') {
    recap.push(m.reply_days_since_contact({ date: formatLocalDay(occurredOn, locale) }));
  }

  return (
    <GesturePanel title={m.reply_title({ name })} onClose={close}>
      <EnterSubmits>
        {(formRef) => (
          <Form
            ref={formRef}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              setWasSent(true);
              if (isDayValid && !isStageMissing && !isTrialUnsettled && !reply.isPending) {
                reply.mutate();
              }
            }}
          >
            <GesturePanelBody>
              <section aria-labelledby={theirReplyId} className="flex flex-col gap-4">
                <h3
                  id={theirReplyId}
                  className="text-xs font-semibold text-muted-foreground uppercase"
                >
                  {m.reply_its_reply()}
                </h3>
                <DoneDayField
                  draft={draft}
                  onChange={(day) => setDraft({ ...draft, ...day })}
                  today={today}
                />
                <SegmentedControl
                  value={draft.channel}
                  onChange={(value) => {
                    const channel = CHANNELS.find((candidate) => candidate === value);
                    if (channel) setDraft({ ...draft, channel });
                  }}
                >
                  <Label>{m.reply_channel()}</Label>
                  <SegmentedControlItems className="flex-wrap">
                    {CHANNELS.map((channel) => (
                      <SegmentedControlItem key={channel} value={channel}>
                        {CHANNEL_LABEL[channel]()}
                      </SegmentedControlItem>
                    ))}
                  </SegmentedControlItems>
                </SegmentedControl>
                <NoteField
                  value={draft.note}
                  onChange={(text) => setDraft({ ...draft, note: text })}
                  maxLength={INTERACTION_NOTE_MAX_LENGTH}
                  takesFocus
                />
              </section>
              {trial && (
                <section aria-labelledby={trialHeadingId} className="flex flex-col gap-4">
                  <h3
                    id={trialHeadingId}
                    className="text-xs font-semibold text-muted-foreground uppercase"
                  >
                    {m.trial_in_progress()}
                  </h3>
                  <TrialRecall state={trial} />
                  <TrialOutcomeField
                    outcomes={REPLY_TRIAL_OUTCOMES}
                    value={trialOutcome}
                    onChange={(outcome) => setDraft({ ...draft, trialOutcome: outcome })}
                  />
                  {trialOutcome === 'no_result' && (
                    <NoResultChoiceField
                      name={name}
                      choice={draft.afterNoResult}
                      reason={draft.reason}
                      onChange={({ choice, reason }) =>
                        setDraft({
                          ...draft,
                          afterNoResult: choice ?? draft.afterNoResult,
                          reason: reason ?? draft.reason,
                        })
                      }
                    />
                  )}
                  {isTrialUnsettled && (
                    <p className="text-muted-foreground">{m.trial_outcome_to_settle()}</p>
                  )}
                </section>
              )}
              {(isOut || followUp !== null || mayScheduleFollowUp) && (
                <section aria-labelledby={thenId} className="flex flex-col gap-4">
                  <h3 id={thenId} className="text-xs font-semibold text-muted-foreground uppercase">
                    {m.reply_then()}
                  </h3>
                  {isOut && (
                    <SegmentedControl
                      value={draft.status}
                      onChange={(value) => {
                        const chosen = REPLY_STATUSES.find((candidate) => candidate === value);
                        if (chosen) setDraft({ ...draft, status: chosen });
                      }}
                    >
                      <Label>{m.reply_status()}</Label>
                      <SegmentedControlItems className="flex-wrap">
                        <SegmentedControlItem value="stay">
                          {contact.status === 'pool'
                            ? m.reply_leave_pool()
                            : m.reply_leave_archived()}
                        </SegmentedControlItem>
                        <SegmentedControlItem value="prospecting">
                          {m.reply_bring_in()}
                        </SegmentedControlItem>
                        <SegmentedControlItem value="ally">
                          {m.reply_add_to_circle()}
                        </SegmentedControlItem>
                      </SegmentedControlItems>
                    </SegmentedControl>
                  )}
                  {status === 'prospecting' && (
                    <StageField
                      summary={summary}
                      stageId={stageId}
                      onChange={(chosen) => setDraft({ ...draft, stageId: chosen })}
                      isMissing={wasSent && isStageMissing}
                    />
                  )}
                  {followUp !== null && (
                    <Checkbox
                      isSelected={draft.cancelFollowUp}
                      onChange={(cancelFollowUp) => setDraft({ ...draft, cancelFollowUp })}
                      className="max-md:min-h-11"
                    >
                      {followUp.rank == null
                        ? m.reply_cancel_follow_up({ date: formatLocalDay(followUp.dueOn, locale) })
                        : m.reply_cancel_follow_up_rank({
                            rank: followUp.rank,
                            date: formatLocalDay(followUp.dueOn, locale),
                          })}
                    </Checkbox>
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
                </section>
              )}
              {recap.length > 0 && <Recap lines={recap} />}
              <ErrorMessage>
                {reply.isError ? m.auth_error() : refusalText(reply.data)}
              </ErrorMessage>
            </GesturePanelBody>
            <GesturePanelFooter>
              <Button
                type="submit"
                className="max-md:min-h-11"
                isDisabled={!isDayValid || isTrialUnsettled || reply.isPending}
              >
                {m.reply_validate()}
              </Button>
            </GesturePanelFooter>
          </Form>
        )}
      </EnterSubmits>
    </GesturePanel>
  );
}

/** The gesture that records an Interaction open on a record, if any: one panel or the other. */
export function InteractionPanels({
  contact,
  summary,
  gesture,
  interaction,
}: {
  contact: SummaryContact;
  summary: Summary;
  gesture: InteractionGesture | undefined;
  interaction: ReturnType<typeof useInteractionGesture>;
}) {
  if (gesture === 'reply') {
    return (
      <ReplyPanel
        key={contact.id}
        contact={contact}
        summary={summary}
        onClose={interaction.close}
        onScheduleFollowUp={() => interaction.chain('schedule')}
      />
    );
  }
  // None for an Ally, from an address kept from before: a Check-in comes with the Circle (ticket 36).
  if (gesture !== 'note' || !canNoteInteraction(contact.status)) return null;
  return (
    <NoteInteractionPanel
      key={contact.id}
      contact={contact}
      summary={summary}
      onClose={interaction.close}
      onReply={() => interaction.open('reply')}
    />
  );
}
