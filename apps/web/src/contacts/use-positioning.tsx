import {
  activityOn,
  canNoteInteraction,
  firstFollowUpOn,
  funnelOf,
  isPoolOrArchived,
  personalized,
  stageToEnter,
} from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useId } from 'react';
import { Form } from 'react-aria-components';
import { z } from 'zod';

import { CHANNEL_LABEL } from '../channel.ts';
import { Button } from '../components/ui/button.tsx';
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
import { PositioningPanel } from '../positionings/positioning-panel.tsx';
import { useApi, type ApiClient } from '../session.ts';
import { useSessionDraft } from '../session-draft.ts';
import { CopyButton } from '../settings/copy-button.tsx';
import { settingsOf } from '../settings/use-settings.ts';
import {
  attachmentsOf,
  positioningsOf,
  todayOf,
  type Summary,
  type SummaryContact,
} from '../summary.ts';
import { AttachmentLinks } from './attachment-links.tsx';
import { StageField, statusRecap } from './change-status.tsx';
import {
  activityRecap,
  DayField,
  doneDayDraft,
  doneDayOf,
  DoneDayField,
  EnterSubmits,
} from './follow-up.tsx';
import { formatLocalDay } from './format.ts';
import type { InteractionGesture, SendGesture } from './status.ts';

/**
 * The use of a Positioning open on the record, carried by the address (ST-70): `open` shows its
 * panel or the creation of a Positioning, `close` takes it away, `chain` gives way to Note an
 * Interaction.
 */
export function useSendPositioning() {
  const { send } = useSearch({ strict: false });
  const navigate = useNavigate();
  return {
    gesture: send,
    open: (gesture: SendGesture) =>
      void navigate({
        to: '.',
        search: (search) => ({ ...search, send: gesture }),
        replace: send !== undefined,
      }),
    close: () =>
      void navigate({ to: '.', search: ({ send: _closed, ...search }) => search, replace: true }),
    chain: (interaction: InteractionGesture) =>
      void navigate({
        to: '.',
        search: ({ send: _closed, ...search }) => ({ ...search, interaction }),
        replace: true,
      }),
  };
}

/** Out of the Funnel, the Contact is brought in first by default, or the use recorded as it is (spec UX §6.1). */
const WAYS = ['bring-in', 'as-is'] as const;

const sendDraft = z.object({
  ...doneDayDraft,
  positioningId: z.string().optional(),
  stageId: z.string().optional(),
  way: z.enum(WAYS),
  /** The day of Follow-up 1 once the User changed it; computed from the Cadence otherwise. */
  followUpOn: z.string().optional(),
});
type SendDraft = z.infer<typeof sendDraft>;

/** The draft of the panel, which the creation of a Positioning hands its new one through. */
const useSendDraft = (contact: SummaryContact) =>
  useSessionDraft<SendDraft>(
    `send:${contact.id}`,
    { choice: 'today', otherDay: '', way: 'bring-in' },
    sendDraft,
  );

/**
 * The Stage whose Positionings are offered: the Contact's own, Prospecting; otherwise the one chosen,
 * or the last one it reached, or the first of the Funnel.
 */
function stageOfSend(contact: SummaryContact, summary: Summary, chosen: string | undefined) {
  if (contact.status === 'prospecting') return contact.stageId ?? undefined;
  const funnel = funnelOf(summary.stages);
  return stageToEnter(funnel, { chosen, last: contact.stageId }) ?? funnel[0]?.id;
}

type SendRefusal = RefusalOf<ApiClient['contacts'][':id']['use-positioning']['$post']>;

/** The panel's own refusals, a day or a Stage, then a Positioning or a Contact changed elsewhere. */
function refusalText(refused: SendRefusal | undefined) {
  if (refused === undefined) return false;
  switch (refused.error) {
    case 'future_day':
      return m.follow_up_day_not_future();
    case 'past_day':
      return m.follow_up_day_not_past();
    case 'stage_required':
    case 'unknown_stage':
      return m.contact_stage_gone();
    case 'unknown_positioning':
    case 'archived':
      return m.positioning_behind();
    default:
      return m.follow_up_behind();
  }
}

const sectionHeading = 'text-xs font-semibold text-muted-foreground uppercase';

/**
 * Send to <Contact> (spec UX §6.1), off any Battle: what to send among the Positionings of the Stage,
 * then the message to copy with the first name in it and the files to download, then the day it was
 * sent and the summary: without a Trial, Follow-up 1 (overdue if it must, its day changeable), +1 to
 * the Activity. “It's sent” (`Enter`) or “Later”, then “Undo”. A Stage without a Positioning blocks
 * it: create one there, or note a free Interaction. The Assignment and Trials come with ticket 28.
 */
function SendPanel({
  contact,
  summary,
  onClose,
  onCreatePositioning,
  onNoteInteraction,
}: {
  contact: SummaryContact;
  summary: Summary;
  onClose: () => void;
  onCreatePositioning: () => void;
  onNoteInteraction: () => void;
}) {
  const locale = useLocale();
  const api = useApi();
  const sendGesture = useSendGesture();
  const whatId = useId();
  const sendId = useId();
  const confirmId = useId();
  const today = todayOf(summary);
  const { name } = contact;
  const [draft, setDraft, clearDraft] = useSendDraft(contact);
  const stageId = stageOfSend(contact, summary, draft.stageId);
  const stage = summary.stages.find(({ id }) => id === stageId);
  const offered = positioningsOf(summary).filter(
    (positioning) => positioning.stageId === stageId && !positioning.archived,
  );
  const chosen = offered.find(({ id }) => id === draft.positioningId) ?? offered[0];
  const isOut = isPoolOrArchived(contact.status);
  const bringsIn = isOut && draft.way === 'bring-in';
  // Only a Contact Prospecting has a Cadence (CONTEXT.md, Status).
  const startsCadence = contact.status === 'prospecting' || bringsIn;
  const { day: occurredOn, isValid: isDayValid } = doneDayOf(draft, today);
  const computedFirstOn =
    chosen && startsCadence && isDayValid
      ? firstFollowUpOn(
          occurredOn,
          chosen.followUps.map(({ days }) => days),
        )
      : undefined;
  const hasFirst = computedFirstOn !== undefined;
  const firstOn = hasFirst ? (draft.followUpOn ?? computedFirstOn) : undefined;
  const isFirstValid =
    draft.followUpOn === undefined ||
    !hasFirst ||
    (/^\d{4}-\d{2}-\d{2}$/u.test(draft.followUpOn) && draft.followUpOn >= today);
  const activityGoal = settingsOf(summary).activityGoal.inEffect;
  const count = activityOn(summary.contacts, today) + 1;
  const close = () => {
    clearDraft();
    onClose();
  };
  const send = useMutation({
    mutationFn: () => {
      if (!chosen) throw new Error('Nothing to send');
      const { label } = chosen;
      return sendGesture(
        api.contacts[':id']['use-positioning'].$post({
          param: { id: contact.id },
          json: {
            positioningId: chosen.id,
            occurredOn,
            ...(hasFirst && draft.followUpOn !== undefined && { followUpOn: draft.followUpOn }),
            ...(bringsIn && { bringIn: true }),
          },
        }),
        ({ contacts: [changed] }) =>
          changed &&
          (firstOn === undefined
            ? m.send_toast_no_follow_up({ name, label })
            : m.send_toast({ name, label, date: formatLocalDay(firstOn, locale) })),
      );
    },
    onSuccess: (refused) => {
      if (!refused) close();
      else if (refused.error === 'unknown_stage' || refused.error === 'stage_required') {
        setDraft({ ...draft, stageId: undefined });
      }
    },
  });

  // Read once the day is one: every line counts from it.
  const recap: React.ReactNode[] = [];
  if (isDayValid && bringsIn) recap.push(...statusRecap('prospecting', summary, locale));
  if (isDayValid) recap.push(m.send_no_trial());
  if (firstOn !== undefined) {
    recap.push(
      <>
        {firstOn < today
          ? m.send_first_follow_up_overdue({ date: formatLocalDay(firstOn, locale) })
          : m.send_first_follow_up({ date: formatLocalDay(firstOn, locale) })}
        {draft.followUpOn === undefined && (
          <>
            {' · '}
            <Button
              variant="link"
              className="h-auto p-0 max-md:min-h-11"
              aria-label={m.send_edit_first_follow_up_label()}
              onPress={() => setDraft({ ...draft, followUpOn: firstOn })}
            >
              {m.send_edit_first_follow_up()}
            </Button>
          </>
        )}
      </>,
    );
  } else if (isDayValid && startsCadence) {
    recap.push(m.send_no_follow_up());
  }
  if (isDayValid && contact.status === 'ally') recap.push(m.send_days_since_contact());
  if (isDayValid) recap.push(activityRecap(occurredOn, today, count, activityGoal, locale));

  const content = chosen?.content ? personalized(chosen.content, name) : undefined;
  const attachments = chosen ? attachmentsOf(chosen) : [];

  return (
    <GesturePanel title={m.send_title({ name })} onClose={close}>
      <EnterSubmits>
        {(formRef) => (
          <Form
            ref={formRef}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (chosen && isDayValid && isFirstValid && !send.isPending) send.mutate();
            }}
          >
            <GesturePanelBody>
              {stage && (
                <p className="text-muted-foreground">{m.send_stage_line({ stage: stage.name })}</p>
              )}
              {isOut && (
                <section className="flex flex-col gap-2 rounded-control border p-3">
                  <p className="font-medium">
                    {contact.status === 'pool' ? m.send_pool({ name }) : m.send_archived({ name })}
                  </p>
                  <p className="text-muted-foreground">{m.send_out_hint()}</p>
                  <SegmentedControl
                    aria-label={m.send_title({ name })}
                    value={draft.way}
                    onChange={(value) => {
                      const way = WAYS.find((candidate) => candidate === value);
                      if (way) setDraft({ ...draft, way });
                    }}
                  >
                    <SegmentedControlItems className="flex-wrap">
                      <SegmentedControlItem value="bring-in">
                        {m.send_bring_in()}
                      </SegmentedControlItem>
                      <SegmentedControlItem value="as-is">
                        {m.send_without_trial()}
                      </SegmentedControlItem>
                    </SegmentedControlItems>
                  </SegmentedControl>
                </section>
              )}
              {contact.status === 'ally' && (
                <p className="text-muted-foreground">{m.send_ally()}</p>
              )}
              {contact.status !== 'prospecting' && (
                <StageField
                  summary={summary}
                  stageId={stageId}
                  onChange={(chosenStage) =>
                    setDraft({ ...draft, stageId: chosenStage, positioningId: undefined })
                  }
                  isMissing={false}
                />
              )}
              {!chosen ? (
                <section className="flex flex-col gap-2 rounded-control border p-3">
                  <p className="font-medium">
                    {stage ? m.send_no_positioning({ stage: stage.name }) : m.send_no_stage()}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {stage && (
                      <Button className="max-md:min-h-11" onPress={onCreatePositioning}>
                        {m.send_create_positioning()}
                      </Button>
                    )}
                    {canNoteInteraction(contact.status) && (
                      <Button
                        variant="outline"
                        className="max-md:min-h-11"
                        onPress={() => {
                          clearDraft();
                          onNoteInteraction();
                        }}
                      >
                        {m.send_note_interaction()}
                      </Button>
                    )}
                  </div>
                </section>
              ) : (
                <>
                  <section aria-labelledby={whatId} className="flex flex-col gap-2">
                    <h3 id={whatId} className={sectionHeading}>
                      {m.send_what()}
                    </h3>
                    {offered.length > 1 ? (
                      <SegmentedControl
                        value={chosen.id}
                        onChange={(value) =>
                          setDraft({ ...draft, positioningId: value, followUpOn: undefined })
                        }
                      >
                        <Label className="sr-only">{m.send_positioning()}</Label>
                        <SegmentedControlItems className="flex-wrap">
                          {offered.map((positioning) => (
                            <SegmentedControlItem key={positioning.id} value={positioning.id}>
                              {positioning.label}
                            </SegmentedControlItem>
                          ))}
                        </SegmentedControlItems>
                      </SegmentedControl>
                    ) : (
                      <p className="font-medium">{chosen.label}</p>
                    )}
                  </section>
                  <section aria-labelledby={sendId} className="flex flex-col gap-2">
                    <h3 id={sendId} className={sectionHeading}>
                      {m.follow_up_send_it()}
                    </h3>
                    <p className="text-muted-foreground">
                      {m.send_by_channel({ channel: CHANNEL_LABEL[chosen.channel]() })}
                    </p>
                    {content !== undefined && (
                      <>
                        <pre className="max-h-40 overflow-auto rounded-control border bg-surface p-2 font-sans whitespace-pre-wrap">
                          {content}
                        </pre>
                        <div className="flex flex-wrap items-center gap-2">
                          <CopyButton text={content} label={m.send_copy()} />
                        </div>
                      </>
                    )}
                    <AttachmentLinks attachments={attachments} />
                    {content === undefined && attachments.length === 0 && (
                      <p className="text-muted-foreground">{m.send_nothing_to_copy()}</p>
                    )}
                  </section>
                  <section aria-labelledby={confirmId} className="flex flex-col gap-4">
                    <h3 id={confirmId} className={sectionHeading}>
                      {m.follow_up_confirm()}
                    </h3>
                    <DoneDayField
                      draft={draft}
                      onChange={(day) => setDraft({ ...draft, ...day })}
                      today={today}
                    />
                    {hasFirst && draft.followUpOn !== undefined && (
                      <DayField
                        value={draft.followUpOn}
                        onChange={(followUpOn) => setDraft({ ...draft, followUpOn })}
                        min={today}
                        error={m.follow_up_day_not_past()}
                        label={m.send_first_follow_up_day()}
                      />
                    )}
                    {isDayValid && (
                      <section
                        aria-label={m.change_status_recap()}
                        className="rounded-control border p-3"
                      >
                        <ul className="list-disc pl-5">
                          {recap.map((line, index) => (
                            // The lines of a summary never move: their place is their key.
                            // oxlint-disable-next-line react/no-array-index-key
                            <li key={index}>{line}</li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </section>
                  <ErrorMessage>
                    {send.isError ? m.auth_error() : refusalText(send.data)}
                  </ErrorMessage>
                </>
              )}
            </GesturePanelBody>
            {chosen && (
              <GesturePanelFooter>
                <Button
                  type="submit"
                  className="max-md:min-h-11"
                  isDisabled={!isDayValid || !isFirstValid || send.isPending}
                >
                  {m.send_validate()}
                </Button>
                <Button variant="ghost" className="max-md:min-h-11" onPress={close}>
                  {m.send_later()}
                </Button>
              </GesturePanelFooter>
            )}
          </Form>
        )}
      </EnterSubmits>
    </GesturePanel>
  );
}

/**
 * The creation of a Positioning for the Stage that has none, opened from the panel “Send to”, which it
 * leads back to with the new one chosen (spec UX §6.10).
 */
function CreateToSend({
  contact,
  summary,
  onBack,
}: {
  contact: SummaryContact;
  summary: Summary;
  onBack: () => void;
}) {
  const [draft, setDraft] = useSendDraft(contact);
  const stageId = stageOfSend(contact, summary, draft.stageId);
  // None to create it at, from an address kept from before: back to the panel, which says why.
  if (stageId === undefined) return null;
  return (
    <PositioningPanel
      kind="new"
      summary={summary}
      stageId={stageId}
      source={undefined}
      onClose={onBack}
      onSaved={onBack}
      back={{
        createLabel: m.send_create_and_send({ name: contact.name }),
        cancelLabel: m.send_cancel_and_back(),
        onCreated: (positioningId) => {
          setDraft({ ...draft, stageId, positioningId });
          onBack();
        },
        onCanceled: onBack,
      }}
    />
  );
}

/** The use of a Positioning open on a record, if any: its panel, or the creation it leads to. */
export function SendPanels({
  contact,
  summary,
  send,
}: {
  contact: SummaryContact;
  summary: Summary;
  send: ReturnType<typeof useSendPositioning>;
}) {
  if (send.gesture === 'new-positioning') {
    return (
      <CreateToSend
        key={contact.id}
        contact={contact}
        summary={summary}
        onBack={() => send.open('positioning')}
      />
    );
  }
  if (send.gesture !== 'positioning') return null;
  return (
    <SendPanel
      key={contact.id}
      contact={contact}
      summary={summary}
      onClose={send.close}
      onCreatePositioning={() => send.open('new-positioning')}
      onNoteInteraction={() => send.chain('note')}
    />
  );
}
