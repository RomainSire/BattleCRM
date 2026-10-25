import { m } from '@battlecrm/i18n';
import {
  canNoteInteraction,
  followUpSignal,
  hasFollowUps,
  isFollowUpDue,
  isPoolOrArchived,
  targetOf,
} from '@battlecrm/domain';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { X } from 'lucide-react';
import { useId, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { CHANNEL_LABEL, CHECK_IN_CHANNEL_LABEL } from '../channel.ts';
import { allySignalOf, TIER_LABEL } from '../circle/ally-signal.ts';
import { RhythmGauge } from '../circle/rhythm-gauge.tsx';
import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { MenuItem, MoreActions } from '../components/ui/menu.tsx';
import { useLocale, type Locale } from '../i18n.ts';
import { useApi } from '../session.ts';
import { settingsOf } from '../settings/use-settings.ts';
import { isModalOpen, useShortcuts } from '../shortcuts.ts';
import {
  organizationOf,
  positioningsOf,
  summaryQuery,
  todayOf,
  type Summary,
  type SummaryContact,
  type SummaryOrganization,
} from '../summary.ts';
import { ChangeStagePanel, useStageGesture } from './change-stage.tsx';
import { ChangeStatusPanel, useStatusGesture } from './change-status.tsx';
import { ContactName } from './contact-name.tsx';
import { contactRecordQuery, type ThreadEntry } from './contact-record-query.ts';
import { EditCoordinates } from './edit-coordinates.tsx';
import { FollowUpHead, FollowUpPanels, useFollowUpGesture } from './follow-up.tsx';
import { formatLocalDay } from './format.ts';
import { InteractionPanels, useInteractionGesture } from './interactions.tsx';
import { targetText } from './organization-field.tsx';
import {
  TrialBlock,
  TrialPanels,
  trialStateOf,
  useTrialGesture,
  type TrialState,
} from './trial.tsx';
import { SendPanels, useSendPositioning } from './use-positioning.tsx';
import {
  otherStatuses,
  prospectingStageOf,
  STATUS_GESTURES,
  STATUS_LABEL,
  STATUS_VERB,
  type FollowUpGesture,
  type InteractionGesture,
  type SendGesture,
  type StatusGesture,
  type TrialGesture,
} from './status.ts';

/** The Contact of the summary, and its Organization; `contact` stays undefined while the summary is not read. */
function useSummaryContact(contactId: string) {
  const api = useApi();
  const { data: summary, isError } = useQuery(summaryQuery(api));
  const contact = summary?.contacts.find(({ id }) => id === contactId);
  return { summary, contact, isError };
}

/** The Target of a Contact as the User reads it. */
const targetLabel = (contact: SummaryContact, summary: Summary) =>
  targetText(targetOf(organizationOf(contact, summary)));

/** The Stage of a Contact Prospecting, with its aim. */
function stageLabel(contact: SummaryContact, summary: Summary) {
  const stage = summary.stages.find(({ id }) => id === contact.stageId);
  if (contact.status !== 'prospecting' || !stage) return undefined;
  return stage.aim === null ? stage.name : `${stage.name} · ${stage.aim}`;
}

/** The label of the Positioning a use sent, as the summary has it. */
const positioningLabel = (summary: Summary, positioningId: string | null) =>
  positioningsOf(summary).find(({ id }) => id === positioningId)?.label ?? '';

/** What an Interaction done says, before its note. */
const DONE_LABEL: Partial<Record<ThreadEntry['kind'], () => string>> = {
  follow_up: m.thread_follow_up,
  call: m.thread_call,
  meeting: m.thread_meeting,
  message: m.thread_message,
  other: m.thread_other,
};

/** The Channel of a reply, or how a Check-in was done. */
const INTERACTION_CHANNEL_LABEL = { ...CHANNEL_LABEL, ...CHECK_IN_CHANNEL_LABEL };

/**
 * What an entry of the thread says: the Interactions done, with their note, a reply with its Channel;
 * the additions and the changes of Status, discreetly.
 */
function threadEntryLabel(
  { kind, note, channel, positioningId, statusChange, stageChange }: ThreadEntry,
  summary: Summary,
) {
  let done = DONE_LABEL[kind]?.();
  if (kind === 'reply' && channel !== null) {
    done = m.thread_reply({ channel: INTERACTION_CHANNEL_LABEL[channel]() });
  }
  if (kind === 'check_in' && channel !== null) {
    done = m.thread_check_in({ channel: INTERACTION_CHANNEL_LABEL[channel]() });
  }
  if (kind === 'positioning_used') {
    done = m.thread_positioning_used({ label: positioningLabel(summary, positioningId) });
  }
  if (done) return [done, note].filter(Boolean).join(' · ');
  // Fallback: a record read from a version from before changes of Stage carries none.
  if (stageChange != null) {
    const nameOf = (stageId: string) => summary.stages.find(({ id }) => id === stageId)?.name ?? '';
    const names = { from: nameOf(stageChange.fromStageId), to: nameOf(stageChange.toStageId) };
    // Forward or back as the Funnel read then (ADR 0003).
    return stageChange.forward ? m.thread_stage_changed(names) : m.thread_stage_back(names);
  }
  if (!statusChange) return undefined;
  const { fromStatus, toStatus, stageId, reason } = statusChange;
  let label;
  if (fromStatus === null && toStatus === 'pool') label = m.thread_added_pool();
  else if (fromStatus === null && toStatus === 'ally') label = m.thread_added_ally();
  else if (fromStatus === null && toStatus === 'prospecting') {
    const stage = summary.stages.find(({ id }) => id === stageId);
    label = m.thread_added_prospecting({ stage: stage?.name ?? '' });
  } else {
    label = m.thread_status_changed({
      from: fromStatus === null ? '' : STATUS_LABEL[fromStatus](),
      to: STATUS_LABEL[toStatus](),
    });
  }
  return reason === null ? label : `${label} · ${reason}`;
}

/** The name of an Organization, which leads to its page (spec UX §5.4). */
const OrganizationLink = ({ organization }: { organization: SummaryOrganization }) => (
  <Link
    to="/organizations/$organizationId"
    params={{ organizationId: organization.id }}
    className="rounded-control underline-offset-4 focus-ring hover:underline"
  >
    {organization.name}
  </Link>
);

/** The head of a record: name, Organization and Target, Stage and Status, LinkedIn (spec UX §5.3). */
function RecordHeader({
  contact,
  summary,
  level,
  headingId,
  headingRef,
  onChangeStatus,
  onChangeStage,
}: {
  contact: SummaryContact;
  summary: Summary;
  level: 1 | 2;
  headingId?: string;
  headingRef?: Ref<HTMLHeadingElement>;
  /** The pill of the Status opens “Change status…” (spec UX §5.3). */
  onChangeStatus: () => void;
  /** The pill of the Stage opens “Change stage…” (spec UX §6.6). */
  onChangeStage: () => void;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  const organization = organizationOf(contact, summary);
  const stage = stageLabel(contact, summary);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Heading
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className={`${level === 1 ? 'text-lg' : 'text-base'} font-semibold outline-none`}
      >
        <ContactName contact={contact} />
      </Heading>
      <p className="text-muted-foreground">
        {organization ? (
          <>
            <OrganizationLink organization={organization} /> · {targetLabel(contact, summary)}
          </>
        ) : (
          m.no_organization()
        )}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {stage && (
          <Button
            variant="outline"
            size="xs"
            className="font-normal text-neutral-text max-md:min-h-11"
            aria-label={m.stage_pill_label({ stage })}
            onPress={onChangeStage}
          >
            {stage}
          </Button>
        )}
        <Button
          variant="outline"
          size="xs"
          className="font-normal text-neutral-text max-md:min-h-11"
          aria-label={m.status_pill_label({ status: STATUS_LABEL[contact.status]() })}
          onPress={onChangeStatus}
        >
          {STATUS_LABEL[contact.status]()}
        </Button>
        {contact.linkedinUrl && (
          <a
            href={contact.linkedinUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-control text-xs text-accent-text underline-offset-4 focus-ring hover:underline"
          >
            {m.contact_linkedin()}
          </a>
        )}
      </div>
    </div>
  );
}

/** The thread, read on demand: from the latest Interaction to the earliest (spec UX §5.3). */
function Thread({ contactId, summary }: { contactId: string; summary: Summary }) {
  const locale = useLocale();
  const api = useApi();
  const { data: record, isError, fetchStatus } = useQuery(contactRecordQuery(api, contactId));
  if (isError) return <ErrorMessage>{m.contact_thread_load_error()}</ErrorMessage>;
  // Read on demand, never kept on the device: offline, it waits for the connection (ADR 0004).
  if (!record && fetchStatus === 'paused') {
    return <p className="text-xs text-muted-foreground">{m.contact_thread_offline()}</p>;
  }
  if (!record) return null;
  return (
    <ol aria-label={m.contact_thread()} className="flex flex-col gap-2">
      {record.thread.map((entry) => (
        <li
          key={entry.id}
          className={cn(
            'flex justify-between gap-3 text-xs',
            // The changes of Stage and of Status are discreet (spec UX §5.3).
            entry.direction === 'none' && 'text-muted-foreground',
          )}
        >
          <span>{threadEntryLabel(entry, summary)}</span>
          <time dateTime={entry.localDate} className="shrink-0">
            {formatLocalDay(entry.localDate, locale)}
          </time>
        </li>
      ))}
    </ol>
  );
}

/**
 * The Coordinates of a Contact (spec UX §5.3), edited in place by “Edit” (§6.12), which gets the focus
 * back once the edit is saved or cancelled; the note comes with the thread.
 */
function Coordinates({
  contact,
  summary,
  level,
  className,
}: {
  contact: SummaryContact;
  summary: Summary;
  level: 2 | 3;
  className?: string;
}) {
  const api = useApi();
  const { data: record } = useQuery(contactRecordQuery(api, contact.id));
  const headingId = useId();
  const [isEditing, setIsEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const Heading = level === 2 ? 'h2' : 'h3';
  const organization = organizationOf(contact, summary);
  const link = 'rounded-control text-accent-text underline-offset-4 focus-ring hover:underline';
  const rows: { label: string; value: ReactNode }[] = [
    { label: m.contact_job_title(), value: contact.jobTitle },
    {
      label: m.contact_organization(),
      value: organization ? <OrganizationLink organization={organization} /> : m.no_organization(),
    },
    { label: m.contact_target(), value: targetLabel(contact, summary) },
    {
      label: m.contact_email(),
      value: contact.email && (
        <a href={`mailto:${contact.email}`} className={link}>
          {contact.email}
        </a>
      ),
    },
    {
      label: m.contact_phone(),
      value: contact.phone && (
        <a href={`tel:${contact.phone}`} className={link}>
          {contact.phone}
        </a>
      ),
    },
    {
      label: m.contact_linkedin(),
      value: contact.linkedinUrl && (
        <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className={link}>
          {contact.linkedinUrl.replace(/^https:\/\//u, '')}
        </a>
      ),
    },
    {
      label: m.contact_note(),
      value: record?.note && <span className="whitespace-pre-line">{record.note}</span>,
    },
    { label: m.contact_stage(), value: prospectingStageOf(contact, summary.stages) },
    {
      label: m.contact_status(),
      value: [STATUS_LABEL[contact.status](), contact.statusReason].filter(Boolean).join(' · '),
    },
  ];
  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Heading id={headingId} className="text-xs font-semibold text-muted-foreground uppercase">
          {m.contact_coordinates()}
        </Heading>
        {!isEditing && (
          <Button
            ref={editButton}
            variant="ghost"
            size="xs"
            className="max-md:min-h-11"
            // The note, with the record, is edited too: it must be read first.
            isDisabled={!record}
            onPress={() => setIsEditing(true)}
          >
            {m.edit()}
          </Button>
        )}
      </div>
      {isEditing && record ? (
        <EditCoordinates
          contact={contact}
          note={record.note}
          summary={summary}
          onDone={() => {
            // The button back at once, whenever the edit ends: then it takes the focus.
            flushSync(() => setIsEditing(false));
            editButton.current?.focus();
          }}
        />
      ) : (
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
          {rows
            .filter(({ value }) => value)
            .map(({ label, value }) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
        </dl>
      )}
    </section>
  );
}

/** What a Contact Prospecting has next: its scheduled Follow-up, with its signal (spec UX §5.3). */
function followUpText(dueOn: string, today: string, locale: Locale) {
  switch (followUpSignal(dueOn, today)) {
    case 'overdue':
      return m.next_action_follow_up_overdue({ date: formatLocalDay(dueOn, locale) });
    case 'today':
      return m.next_action_follow_up_today();
    default:
      return m.next_action_follow_up_upcoming({ date: formatLocalDay(dueOn, locale) });
  }
}

/** What a Contact Prospecting without a Follow-up waits for: its Trial in progress, and its Response window. */
function trialText({ positioning, isElapsed, endsOn }: TrialState, locale: Locale) {
  const label = positioning.label;
  if (isElapsed || endsOn === undefined) return m.next_action_trial_elapsed({ label });
  return m.next_action_trial_waiting({ label, date: formatLocalDay(endsOn, locale) });
}

/** What the record says of the Status of the Contact, before its actions (spec UX §5.3). */
function nextActionText(contact: SummaryContact, summary: Summary, locale: Locale): string {
  const { followUp } = contact;
  switch (contact.status) {
    case 'pool': {
      const last = summary.stages.find(({ id }) => id === contact.stageId);
      return last ? m.next_action_pool({ stage: last.name }) : m.next_action_pool_never();
    }
    case 'prospecting': {
      if (followUp) return followUpText(followUp.dueOn, todayOf(summary), locale);
      const trial = trialStateOf(contact, summary);
      return trial ? trialText(trial, locale) : m.no_next_action();
    }
    // Its Days since contact, and its Follow-up, which comes before the Rhythm (spec UX §5.3).
    case 'ally': {
      const today = todayOf(summary);
      const { daysSinceContact: days } = allySignalOf(contact, summary, today);
      const ally = m.next_action_ally({ days });
      return followUp ? `${ally} · ${followUpText(followUp.dueOn, today, locale)}` : ally;
    }
    default:
      return STATUS_LABEL.archived();
  }
}

const isStatusGesture = (key: unknown): key is StatusGesture =>
  STATUS_GESTURES.some((gesture) => gesture === key);

/** The keys of the menu `⋯` for the Follow-up and the Interactions, apart from the Statuses. */
const FOLLOW_UP_MENU = { 'follow-up:do': 'do', 'follow-up:schedule': 'schedule' } as const;
const followUpOfKey = (key: unknown): FollowUpGesture | undefined =>
  Object.entries(FOLLOW_UP_MENU).find(([candidate]) => candidate === key)?.[1];
const INTERACTION_MENU = { 'interaction:note': 'note', 'interaction:reply': 'reply' } as const;
const interactionOfKey = (key: unknown): InteractionGesture | undefined =>
  Object.entries(INTERACTION_MENU).find(([candidate]) => candidate === key)?.[1];
const SEND_MENU_KEY = 'send:positioning';
const STAGE_MENU_KEY = 'stage:choose';

/**
 * The block Next action (spec UX §5.3): what the Status of the Contact calls for, its full button, and
 * the verbs of the other Statuses: as secondary buttons on the page (from the desktop width), under `⋯`
 * everywhere, with “Change status…”.
 */
function NextAction({
  contact,
  summary,
  level,
  showsVerbs,
  onGesture,
  onFollowUp,
  onInteraction,
  onSend,
  onTrial,
  onStage,
}: {
  contact: SummaryContact;
  summary: Summary;
  level: 2 | 3;
  showsVerbs: boolean;
  onStage: () => void;
  onGesture: (gesture: StatusGesture) => void;
  onFollowUp: (gesture: FollowUpGesture) => void;
  onInteraction: (gesture: InteractionGesture) => void;
  onSend: (gesture: SendGesture) => void;
  onTrial: (gesture: TrialGesture) => void;
}) {
  const locale = useLocale();
  const headingId = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  const isOut = isPoolOrArchived(contact.status);
  // Out of the Funnel, the way back is the action of the moment.
  const primary = isOut ? 'prospecting' : undefined;
  const others = otherStatuses(contact.status).filter((status) => status !== primary);
  // A Follow-up due, today or overdue, is the action of the moment (spec UX §5.3).
  const isDue =
    contact.followUp !== null && isFollowUpDue(contact.followUp.dueOn, todayOf(summary));
  const isProspecting = contact.status === 'prospecting';
  const trial = isProspecting ? trialStateOf(contact, summary) : undefined;
  // Its Trial past its Response window, nothing scheduled: No result… (spec UX §5.3).
  const isElapsed = trial?.isElapsed === true;
  // Neither a Follow-up nor a Trial: a Positioning to use (spec UX §5.3).
  const sendsFirst = isProspecting && contact.followUp === null && trial === undefined;
  // Waiting, a reply is what may come next (spec UX §5.3).
  const repliesFirst = isProspecting && !isDue && !isElapsed && !sendsFirst;
  // An Ally: Follow up… when its Follow-up is due, Check in… otherwise (spec UX §5.3).
  const isAlly = contact.status === 'ally';
  const ally = isAlly ? allySignalOf(contact, summary, todayOf(summary)) : undefined;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 rounded-card border p-3">
      <Heading id={headingId} className="text-xs font-semibold text-muted-foreground uppercase">
        {m.next_action()}
      </Heading>
      <p>{nextActionText(contact, summary, locale)}</p>
      {ally && (
        <div className="flex items-center gap-2">
          <RhythmGauge
            signal={ally}
            rhythmDays={settingsOf(summary).checkInRhythmDays}
            className="max-w-48"
          />
          <span className={cn('text-xs', ally.signal !== 'none' && 'font-medium')}>
            {TIER_LABEL[ally.signal]()}
          </span>
        </div>
      )}
      {contact.status === 'archived' && (
        <>
          {contact.statusReason && <p>{m.next_action_reason({ reason: contact.statusReason })}</p>}
          <p>{m.next_action_archived()}</p>
        </>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {primary && (
          <Button className="max-md:min-h-11" onPress={() => onGesture(primary)}>
            {STATUS_VERB[primary]()}
          </Button>
        )}
        {isDue && (
          <Button className="max-md:min-h-11" onPress={() => onFollowUp('do')}>
            {m.verb_follow_up()}
          </Button>
        )}
        {sendsFirst && (
          <Button className="max-md:min-h-11" onPress={() => onSend('positioning')}>
            {m.verb_use_positioning()}
          </Button>
        )}
        {isElapsed && (
          <>
            <Button className="max-md:min-h-11" onPress={() => onTrial('no-result')}>
              {m.verb_no_result()}
            </Button>
            <Button
              variant="outline"
              className="max-md:min-h-11"
              size={level === 3 ? 'sm' : 'default'}
              onPress={() => onFollowUp('anyway')}
            >
              {m.verb_follow_up_anyway()}
            </Button>
          </>
        )}
        {isAlly && (
          // In full unless the Follow-up due comes first; then beside it, where “Note” would be.
          <Button
            variant={isDue ? 'outline' : 'default'}
            className="max-md:min-h-11"
            size={isDue && level === 3 ? 'sm' : 'default'}
            onPress={() => onInteraction('check-in')}
          >
            {m.verb_check_in()}
          </Button>
        )}
        {repliesFirst && (
          <Button className="max-md:min-h-11" onPress={() => onInteraction('reply')}>
            {m.verb_reply()}
          </Button>
        )}
        {canNoteInteraction(contact.status) && (
          <Button
            variant="outline"
            className="max-md:min-h-11"
            size={level === 3 ? 'sm' : 'default'}
            onPress={() => onInteraction('note')}
          >
            {m.verb_note_interaction()}
          </Button>
        )}
        {showsVerbs && !repliesFirst && (
          <Button
            variant="outline"
            className="max-md:hidden"
            size={level === 3 ? 'sm' : 'default'}
            onPress={() => onInteraction('reply')}
          >
            {m.verb_reply()}
          </Button>
        )}
        {showsVerbs &&
          others.map((status) => (
            <Button
              key={status}
              variant="outline"
              className="max-md:hidden"
              onPress={() => onGesture(status)}
              size={level === 3 ? 'sm' : 'default'}
            >
              {STATUS_VERB[status]()}
            </Button>
          ))}
        <MoreActions
          onAction={(key) => {
            if (isStatusGesture(key)) onGesture(key);
            const followUp = followUpOfKey(key);
            if (followUp) onFollowUp(followUp);
            const interaction = interactionOfKey(key);
            if (interaction) onInteraction(interaction);
            if (key === SEND_MENU_KEY) onSend('positioning');
            if (key === STAGE_MENU_KEY) onStage();
          }}
        >
          {!sendsFirst && <MenuItem id={SEND_MENU_KEY}>{m.verb_use_positioning()}</MenuItem>}
          <MenuItem id="interaction:reply">{m.verb_reply()}</MenuItem>
          {contact.followUp && !isDue && (
            <MenuItem id="follow-up:do">{m.verb_follow_up()}</MenuItem>
          )}
          {hasFollowUps(contact.status) && (
            <MenuItem id="follow-up:schedule">
              {contact.followUp ? m.verb_edit_follow_up() : m.verb_schedule_follow_up()}
            </MenuItem>
          )}
          {isProspecting && <MenuItem id={STAGE_MENU_KEY}>{m.verb_change_stage()}</MenuItem>}
          {others.map((status) => (
            <MenuItem key={status} id={status}>
              {STATUS_VERB[status]()}
            </MenuItem>
          ))}
          <MenuItem id="choose">{m.verb_change_status()}</MenuItem>
        </MoreActions>
      </div>
    </section>
  );
}

/** The gestures a record opens, each kept by the address (ST-70). */
export function useRecordGestures() {
  return {
    status: useStatusGesture(),
    followUp: useFollowUpGesture(),
    interaction: useInteractionGesture(),
    send: useSendPositioning(),
    trial: useTrialGesture(),
    stage: useStageGesture(),
  };
}
export type RecordGestures = ReturnType<typeof useRecordGestures>;

/**
 * The panels of the gestures open on a Contact, wherever they were opened from: its record, or its
 * card in the Funnel (spec UX §1, one form per gesture). Out of any region: their Escape is their own.
 */
export function RecordGesturePanels({
  contact,
  summary,
  gestures: { status, stage, followUp, interaction, send, trial },
}: {
  contact: SummaryContact;
  summary: Summary;
  gestures: RecordGestures;
}) {
  return (
    <>
      {status.gesture && (
        <ChangeStatusPanel
          key={`${contact.id}:${status.gesture}`}
          contact={contact}
          summary={summary}
          gesture={status.gesture}
          onClose={status.close}
        />
      )}
      {stage.gesture && contact.status === 'prospecting' && (
        <ChangeStagePanel
          key={contact.id}
          contact={contact}
          summary={summary}
          gesture={stage.gesture}
          onClose={stage.close}
          onChain={stage.chain}
        />
      )}
      <FollowUpPanels
        contact={contact}
        summary={summary}
        gesture={followUp.gesture}
        onClose={followUp.close}
      />
      <InteractionPanels
        contact={contact}
        summary={summary}
        gesture={interaction.gesture}
        interaction={interaction}
      />
      <SendPanels contact={contact} summary={summary} send={send} />
      <TrialPanels
        contact={contact}
        summary={summary}
        gesture={trial.gesture}
        onClose={trial.close}
      />
    </>
  );
}

/**
 * The keys of the record that has the focus (spec UX §3.3): anywhere on its page, within its panel
 * only. `S` opens “Change status…”, `E` “Change stage…”, `P` Schedule or Edit the follow-up, `F`
 * Follow up…, `I` Note an Interaction (Check in… on an Ally), `U` Use a Positioning.
 */
function useRecordKeys(
  contact: SummaryContact | undefined,
  summary: Summary | undefined,
  { status, followUp, interaction, send, stage }: RecordGestures,
  scope?: RefObject<HTMLElement | null>,
) {
  const onKey = (open: () => void) => (event: KeyboardEvent) => {
    if (!contact || isModalOpen()) return;
    if (scope && !scope.current?.contains(document.activeElement)) return;
    // Or the letter would be typed into the field that takes the focus.
    event.preventDefault();
    open();
  };
  useShortcuts({
    s: onKey(() => status.open('choose')),
    // Only a Contact Prospecting changes Stage (CONTEXT.md, Status).
    e: onKey(() => {
      if (contact?.status === 'prospecting') stage.open('choose');
    }),
    p: onKey(() => {
      if (contact && hasFollowUps(contact.status)) followUp.open('schedule');
    }),
    // On an Ally, the full action of the moment: Follow up… when it is due, Check in… otherwise.
    f: onKey(() => {
      if (!contact || !summary) return;
      const isDue = contact.followUp && isFollowUpDue(contact.followUp.dueOn, todayOf(summary));
      if (contact.status === 'ally' && !isDue) interaction.open('check-in');
      else if (contact.followUp) followUp.open('do');
    }),
    i: onKey(() => {
      if (contact?.status === 'ally') interaction.open('check-in');
      else if (contact && canNoteInteraction(contact.status)) interaction.open('note');
    }),
    u: onKey(() => send.open('positioning')),
  });
}

/** The Trial in progress of a Contact Prospecting, if it has one (spec UX §5.3). */
function CurrentTrial({
  contact,
  summary,
  ...props
}: {
  contact: SummaryContact;
  summary: Summary;
  level: 2 | 3;
  onReply: () => void;
  className?: string;
}) {
  const state = contact.status === 'prospecting' ? trialStateOf(contact, summary) : undefined;
  return state ? <TrialBlock state={state} {...props} /> : null;
}

/** While the summary is read: nothing, or why it cannot be. */
const SummaryMissing = ({ isError }: { isError: boolean }) => (
  <ErrorMessage>{isError && m.contacts_load_error()}</ErrorMessage>
);

const tabClass =
  'cursor-default rounded-control px-2 py-1 text-muted-foreground focus-ring data-hovered:text-foreground data-selected:bg-surface data-selected:font-medium data-selected:text-foreground';

/**
 * The record in a panel, anchored next to the list of Contacts (spec UX §5.3, §5.10): no modal, a
 * region of the layout (ST-66). Its heading takes the focus when a row opens it; `Escape` closes it.
 */
export function ContactPanel({
  contactId,
  headingRef,
  onClose,
}: {
  contactId: string;
  headingRef: Ref<HTMLHeadingElement>;
  onClose: () => void;
}) {
  useLocale();
  const { summary, contact, isError } = useSummaryContact(contactId);
  const headingId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const gestures = useRecordGestures();
  const { status, followUp, interaction, send, trial, stage } = gestures;
  useRecordKeys(contact, summary, gestures, panelRef);
  const close = (
    <Button variant="ghost" size="icon-sm" aria-label={m.close()} onPress={onClose}>
      <X />
    </Button>
  );
  if (!summary) return <SummaryMissing isError={isError} />;
  if (!contact) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-card border p-4">
        <p className="text-muted-foreground">{m.contact_unknown()}</p>
        {close}
      </div>
    );
  }
  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape from any control inside the panel, while the focus is there. */}
      <section
        ref={panelRef}
        aria-labelledby={headingId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
        className={cn(
          'flex flex-col gap-3 rounded-card border p-4',
          // An archived record is greyed (spec UX §5.3).
          contact.status === 'archived' && 'bg-surface text-muted-foreground',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <RecordHeader
            contact={contact}
            summary={summary}
            level={2}
            headingId={headingId}
            headingRef={headingRef}
            onChangeStatus={() => status.open('choose')}
            onChangeStage={() => stage.open('choose')}
          />
          {close}
        </div>
        <NextAction
          contact={contact}
          summary={summary}
          level={3}
          // Archived, the ways back are all in sight (spec UX §5.3).
          showsVerbs={contact.status === 'archived'}
          onGesture={status.open}
          onFollowUp={followUp.open}
          onInteraction={interaction.open}
          onSend={send.open}
          onTrial={trial.open}
          onStage={() => stage.open('choose')}
        />
        <Tabs>
          <TabList aria-label={contact.name} className="flex gap-1 border-b pb-2">
            <Tab id="thread" className={tabClass}>
              {m.contact_thread()}
            </Tab>
            <Tab id="details" className={tabClass}>
              {m.contact_details()}
            </Tab>
          </TabList>
          <TabPanel id="thread" className="rounded-control pt-3 focus-ring">
            <FollowUpHead contact={contact} summary={summary} onGesture={followUp.open} />
            <Thread contactId={contactId} summary={summary} />
          </TabPanel>
          <TabPanel id="details" className="flex flex-col gap-4 rounded-control pt-3 focus-ring">
            <CurrentTrial
              contact={contact}
              summary={summary}
              level={3}
              onReply={() => interaction.open('reply')}
            />
            <Coordinates contact={contact} summary={summary} level={3} />
          </TabPanel>
        </Tabs>
        <Link
          to="/contacts/$contactId"
          params={{ contactId }}
          className="self-start rounded-control text-accent-text underline-offset-4 focus-ring hover:underline"
        >
          {m.open_as_page()}
        </Link>
      </section>
      {/* Out of the panel: its Escape is the gesture's own. */}
      <RecordGesturePanels contact={contact} summary={summary} gestures={gestures} />
    </>
  );
}

/** The record as a page of its own, under Contacts (spec UX §3.1, §5.3); stacked on mobile. */
export function ContactPage({ contactId }: { contactId: string }) {
  useLocale();
  const { summary, contact, isError } = useSummaryContact(contactId);
  const threadHeadingId = useId();
  const gestures = useRecordGestures();
  const { status, followUp, interaction, send, trial, stage } = gestures;
  useRecordKeys(contact, summary, gestures);
  const backToContacts = (
    <Link to="/contacts" className="rounded-control underline-offset-4 focus-ring hover:underline">
      {m.contacts()}
    </Link>
  );
  return (
    <div
      className={cn(
        'flex flex-col gap-4 px-4 py-5 md:px-6',
        // An archived record is greyed (spec UX §5.3).
        contact?.status === 'archived' && 'text-muted-foreground',
      )}
    >
      <title>{`${contact?.name ?? m.contacts()} · BattleCRM`}</title>
      {!summary ? (
        <SummaryMissing isError={isError} />
      ) : !contact ? (
        <>
          <p className="text-muted-foreground">{m.contact_unknown()}</p>
          <p>{backToContacts}</p>
        </>
      ) : (
        <>
          <nav aria-label={m.breadcrumb()}>
            <ol className="flex gap-1.5 text-xs text-muted-foreground">
              <li>{backToContacts}</li>
              <li aria-hidden="true">›</li>
              <li aria-current="page" className="truncate">
                {contact.name}
              </li>
            </ol>
          </nav>
          <RecordHeader
            contact={contact}
            summary={summary}
            level={1}
            onChangeStatus={() => status.open('choose')}
            onChangeStage={() => stage.open('choose')}
          />
          <NextAction
            contact={contact}
            summary={summary}
            level={2}
            showsVerbs
            onGesture={status.open}
            onFollowUp={followUp.open}
            onInteraction={interaction.open}
            onSend={send.open}
            onTrial={trial.open}
            onStage={() => stage.open('choose')}
          />
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
            {/* Stacked on mobile, the Trial in progress and the Coordinates come first (spec UX §5.3). */}
            <div className="flex flex-col gap-4 self-start md:col-start-2 md:row-start-1">
              <CurrentTrial
                contact={contact}
                summary={summary}
                level={2}
                className="rounded-card border p-4"
                onReply={() => interaction.open('reply')}
              />
              <Coordinates
                contact={contact}
                summary={summary}
                level={2}
                className="rounded-card border p-4"
              />
            </div>
            <section aria-labelledby={threadHeadingId} className="md:col-start-1 md:row-start-1">
              <h2
                id={threadHeadingId}
                className="mb-2 text-xs font-semibold text-muted-foreground uppercase"
              >
                {m.contact_thread()}
              </h2>
              <FollowUpHead contact={contact} summary={summary} onGesture={followUp.open} />
              <Thread contactId={contactId} summary={summary} />
            </section>
          </div>
          <RecordGesturePanels contact={contact} summary={summary} gestures={gestures} />
        </>
      )}
    </div>
  );
}
