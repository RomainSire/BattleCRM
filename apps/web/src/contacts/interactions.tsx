import {
  CHANNELS,
  INTERACTION_NOTE_MAX_LENGTH,
  NOTED_INTERACTION_KINDS,
  type Channel,
  type NotedInteractionKind,
} from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { Form } from 'react-aria-components';
import { z } from 'zod';

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
import { useLocale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';
import { useSessionDraft } from '../session-draft.ts';
import { SUMMARY_KEY, type Summary, type SummaryChanges, type SummaryContact } from '../summary.ts';
import {
  enteredStageOf,
  StageField,
  stageInFunnel,
  statusChangedMessage,
  statusRecap,
} from './change-status.tsx';
import {
  doneDayDraft,
  doneDayOf,
  DoneDayField,
  EnterSubmits,
  NoteField,
  Recap,
  settle,
  todayOf,
  trimmed,
} from './follow-up.tsx';
import { formatLocalDay } from './format.ts';
import type { FollowUpGesture, InteractionGesture } from './status.ts';

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

/** With an Ally, a free outbound Interaction is a Check-in (spec UX §6.4), which comes with the Circle (ticket 36). */
export const canNoteInteraction = ({ status }: SummaryContact) => status !== 'ally';

const KIND_LABEL: Record<NotedInteractionKind, () => string> = {
  call: m.interaction_kind_call,
  meeting: m.interaction_kind_meeting,
  message: m.interaction_kind_message,
  other: m.interaction_kind_other,
};

/** A Channel as the User reads it. */
export const CHANNEL_LABEL: Record<Channel, () => string> = {
  email: m.channel_email,
  linkedin: m.channel_linkedin,
  phone: m.channel_phone,
  mail: m.channel_mail,
};

/** What a gesture answers: its changes, or a refusal the panel shows. */
type Answer = { changes: SummaryChanges; undoToken: string } | 'bad_day' | 'stage_gone' | 'behind';

/** A refusal of the server: a day or a Stage it refuses is the panel's to show; anything else, a Contact changed elsewhere. */
async function refusalOf(response: {
  status: number;
  json(): Promise<unknown>;
}): Promise<Exclude<Answer, object> | undefined> {
  if (response.status !== 400 && response.status !== 404 && response.status !== 409)
    return undefined;
  const { error } = z.object({ error: z.string() }).parse(await response.json());
  if (error === 'future_day') return 'bad_day';
  if (error === 'stage_required' || error === 'unknown_stage') return 'stage_gone';
  // A body the server would not read is this app's error, never the User's.
  if (error === 'invalid') throw new Error('A gesture recording an Interaction was refused');
  return 'behind';
}

const send = {
  async note(
    api: ApiClient,
    contactId: string,
    json: { kind: NotedInteractionKind; occurredOn: string; note?: string },
  ): Promise<Answer> {
    const response = await api.contacts[':id']['note-interaction'].$post({
      param: { id: contactId },
      json,
    });
    const refused = await refusalOf(response);
    if (refused) return refused;
    if (!response.ok) throw new Error('POST /api/contacts/:id/note-interaction failed');
    return response.json();
  },
  async reply(
    api: ApiClient,
    contactId: string,
    json: {
      occurredOn: string;
      channel: Channel;
      note?: string;
      cancelFollowUp?: boolean;
      status?: 'prospecting' | 'ally';
      stageId?: string;
    },
  ): Promise<Answer> {
    const response = await api.contacts[':id']['record-reply'].$post({
      param: { id: contactId },
      json,
    });
    const refused = await refusalOf(response);
    if (refused) return refused;
    if (!response.ok) throw new Error('POST /api/contacts/:id/record-reply failed');
    return response.json();
  },
};

/** The panel's own refusals, then a Contact changed elsewhere. */
function refusalText(answer: Answer | undefined) {
  if (answer === 'bad_day') return m.follow_up_day_not_future();
  if (answer === 'stage_gone') return m.contact_stage_gone();
  return answer === 'behind' && m.follow_up_behind();
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
  const api = useApi();
  const queryClient = useQueryClient();
  const today = todayOf(summary);
  const { name } = contact;
  const [draft, setDraft, clearDraft] = useSessionDraft(
    `note-interaction:${contact.id}`,
    { choice: 'today' as const, otherDay: '', kind: 'call' as const, note: '' },
    noteDraft,
  );
  const { day: occurredOn, isValid: isDayValid } = doneDayOf(draft, today);
  const close = () => {
    clearDraft();
    onClose();
  };
  const note = useMutation({
    mutationFn: () =>
      send.note(api, contact.id, { kind: draft.kind, occurredOn, ...trimmed(draft.note) }),
    onSuccess: async (answer) => {
      if (typeof answer === 'string') {
        await queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
        return;
      }
      if (await settle(queryClient, answer, () => m.note_interaction_toast({ name }))) close();
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
              <Recap lines={[m.note_interaction_off_activity()]} />
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
});

/**
 * Replied… (spec UX §6.2): the reply, its day, Channel and note, never a nature (ADR 0005); then what
 * comes next. From the Pool or Archived: leave it (by default), bring it in or add it to the Circle.
 * The scheduled Follow-up canceled (checked), or “Schedule a follow-up…” once recorded. Settling a
 * Trial comes with Trials (ticket 29).
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
  const queryClient = useQueryClient();
  const theirReplyId = useId();
  const thenId = useId();
  const today = todayOf(summary);
  const { name, followUp } = contact;
  const isOut = contact.status === 'pool' || contact.status === 'archived';
  const [draft, setDraft, clearDraft] = useSessionDraft(
    `reply:${contact.id}`,
    {
      choice: 'today' as const,
      otherDay: '',
      channel: 'email' as const,
      note: '',
      status: 'stay' as const,
      stageId: enteredStageOf(contact, summary),
      cancelFollowUp: true,
      scheduleFollowUp: false,
    },
    replyDraft,
  );
  const [wasSent, setWasSent] = useState(false);
  const { day: occurredOn, isValid: isDayValid } = doneDayOf(draft, today);
  const status = isOut && draft.status !== 'stay' ? draft.status : undefined;
  const stageId = stageInFunnel(summary, draft.stageId);
  const isStageMissing = status === 'prospecting' && stageId === undefined;
  // Its scheduled Follow-up may be canceled; one may be scheduled once in a Status that has some.
  const cancelsFollowUp = followUp !== null && draft.cancelFollowUp;
  const statusAfter = status ?? contact.status;
  const mayScheduleFollowUp = statusAfter === 'prospecting' || statusAfter === 'ally';
  const close = () => {
    clearDraft();
    onClose();
  };
  const reply = useMutation({
    mutationFn: () =>
      send.reply(api, contact.id, {
        occurredOn,
        channel: draft.channel,
        ...trimmed(draft.note),
        ...(cancelsFollowUp && { cancelFollowUp: true }),
        ...(status && { status }),
        ...(status === 'prospecting' && stageId !== undefined && { stageId }),
      }),
    onSuccess: async (answer) => {
      if (typeof answer === 'string') {
        if (answer === 'stage_gone') setDraft({ ...draft, stageId: undefined });
        await queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
        return;
      }
      const isSettled = await settle(queryClient, answer, (changed) =>
        status ? statusChangedMessage(changed, status, summary) : m.reply_toast({ name }),
      );
      if (!isSettled) return;
      clearDraft();
      if (mayScheduleFollowUp && draft.scheduleFollowUp) onScheduleFollowUp();
      else onClose();
    },
  });

  const recap: string[] = [];
  if (cancelsFollowUp) {
    recap.push(m.change_status_cancels_follow_up({ date: formatLocalDay(followUp.dueOn, locale) }));
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
              if (isDayValid && !isStageMissing && !reply.isPending) reply.mutate();
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
                      {m.reply_cancel_follow_up({ date: formatLocalDay(followUp.dueOn, locale) })}
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
                isDisabled={!isDayValid || reply.isPending}
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
  // None for an Ally, from an address kept from before.
  if (gesture !== 'note' || !canNoteInteraction(contact)) return null;
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
