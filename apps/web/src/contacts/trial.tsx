import {
  STATUS_REASON_MAX_LENGTH,
  type ReplyTrialOutcome,
  type SettledTrialOutcome,
} from '@battlecrm/contract';
import {
  daysBetween,
  isWindowElapsed,
  responseWindowEndsOn,
  statusChangeCancelsFollowUp,
} from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useId, useRef } from 'react';
import { Form, TextField } from 'react-aria-components';
import { z } from 'zod';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import {
  GesturePanel,
  GesturePanelBody,
  GesturePanelFooter,
} from '../components/ui/gesture-panel.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '../components/ui/segmented-control.tsx';
import { useSendGesture } from '../gesture.ts';
import { useLocale, type Locale } from '../i18n.ts';
import { useApi } from '../session.ts';
import { useSessionDraft } from '../session-draft.ts';
import {
  battlesOf,
  positioningsOf,
  todayOf,
  trialOf,
  type Summary,
  type SummaryChanges,
  type SummaryContact,
} from '../summary.ts';
import { statusChangedMessage } from './change-status.tsx';
import { EnterSubmits, Recap } from './follow-up.tsx';
import { formatLocalDay } from './format.ts';
import type { TrialGesture } from './status.ts';

/**
 * The gesture on the Trial in progress open on the record, carried by the address (ST-70): `open`
 * shows its panel, `close` takes it away.
 */
export function useTrialGesture() {
  const { trial } = useSearch({ strict: false });
  const navigate = useNavigate();
  return {
    gesture: trial,
    open: (gesture: TrialGesture) =>
      void navigate({ to: '.', search: (search) => ({ ...search, trial: gesture }) }),
    close: () =>
      void navigate({ to: '.', search: ({ trial: _closed, ...search }) => search, replace: true }),
  };
}

/**
 * What the Response window of the Trial in progress of a Contact is read from (CONTEXT.md): its last
 * Interaction done, or else the use that started it, and the window of its Positioning. `undefined`
 * without one, or while the summary does not know its Positioning.
 */
export function trialWindowOf(contact: SummaryContact, summary: Summary) {
  const trial = trialOf(contact);
  const positioning = trial && positioningsOf(summary).find(({ id }) => id === trial.positioningId);
  if (!trial || !positioning) return undefined;
  return {
    trial,
    positioning,
    lastDoneOn: contact.lastDoneInteractionOn ?? trial.startedOn,
    responseWindowDays: positioning.responseWindowDays,
  };
}

/**
 * Where the Trial in progress of a Contact stands (spec UX §5.3): its Positioning, its Battle and
 * Stage, its role, and its Response window, read from the last Interaction done (CONTEXT.md).
 * `undefined` without one, or while the summary does not know its Battle.
 */
export function trialStateOf(contact: SummaryContact, summary: Summary) {
  const read = trialWindowOf(contact, summary);
  if (!read) return undefined;
  const { trial, positioning, lastDoneOn, responseWindowDays } = read;
  const battle = battlesOf(summary).find(({ id }) => id === trial.battleId);
  if (!battle) return undefined;
  const stage = summary.stages.find(({ id }) => id === battle.stageId);
  const today = todayOf(summary);
  const window = { followUp: contact.followUp, lastDoneOn, responseWindowDays };
  return {
    trial,
    battle,
    positioning,
    stageName: stage?.name ?? '',
    isChampion: battle.championId === positioning.id,
    today,
    lastDoneOn,
    endsOn: responseWindowEndsOn(window),
    isElapsed: isWindowElapsed(window, today),
  };
}
export type TrialState = NonNullable<ReturnType<typeof trialStateOf>>;

/** The Criterion recalled where the Trial is settled (spec UX §6.2, §6.6, §6.11). */
export const TrialRecall = ({ state }: { state: TrialState }) => (
  <p>
    {m.trial_recall({
      label: state.positioning.label,
      stage: state.stageName,
      criterion: state.battle.successCriterion,
    })}
  </p>
);

/**
 * The block Trial in progress of the record (spec UX §5.3): Positioning, Battle and role, Criterion,
 * duration, its Response window, and “Replied…”.
 */
export function TrialBlock({
  state,
  level,
  onReply,
  className,
}: {
  state: TrialState;
  level: 2 | 3;
  onReply: () => void;
  className?: string;
}) {
  const locale = useLocale();
  const headingId = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  const { trial, positioning, battle, stageName, isChampion, endsOn, isElapsed, today } = state;
  let window = m.trial_window_follow_up();
  if (isElapsed) window = m.trial_window_elapsed();
  else if (endsOn !== undefined) {
    window = m.trial_window_ends({ date: formatLocalDay(endsOn, locale) });
  }
  const rows = [
    {
      label: m.trial_positioning(),
      value: trial.overridden ? `${positioning.label} · ${m.trial_override()}` : positioning.label,
    },
    {
      label: m.trial_battle(),
      value: m.trial_battle_value({
        stage: stageName,
        role: isChampion ? m.battle_champion() : m.battle_challenger(),
      }),
    },
    { label: m.trial_criterion(), value: battle.successCriterion },
    {
      label: m.trial_duration(),
      value: m.trial_duration_value({
        days: Math.max(0, daysBetween(trial.startedOn, today)),
        date: formatLocalDay(trial.startedOn, locale),
      }),
    },
    { label: m.trial_signal(), value: window },
  ];
  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Heading id={headingId} className="text-xs font-semibold text-muted-foreground uppercase">
          {m.trial_in_progress()}
        </Heading>
        <Button variant="ghost" size="xs" className="max-md:min-h-11" onPress={onReply}>
          {m.verb_reply()}
        </Button>
      </div>
      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
        {rows.map(({ label, value }) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const OUTCOME_LABEL: Record<ReplyTrialOutcome | SettledTrialOutcome, () => string> = {
  success: m.trial_outcome_success,
  no_result: m.trial_outcome_no_result,
  in_progress: m.trial_outcome_in_progress,
  canceled: m.trial_outcome_canceled,
};

/** Whether a key pressed there belongs to another field of the panel: typed, or another choice. */
const isOtherField = (target: EventTarget | null, field: HTMLElement | null) =>
  (target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLInputElement) &&
  !field?.contains(target);

/**
 * The outcome of the Trial, chosen by the User, never preselected from a reply (ADR 0005): `1`, `2`,
 * `3` choose it from anywhere in the panel but a field (spec UX §6.2).
 */
export function TrialOutcomeField<Outcome extends ReplyTrialOutcome | SettledTrialOutcome>({
  outcomes,
  value,
  onChange,
}: {
  outcomes: readonly Outcome[];
  value: Outcome | undefined;
  onChange: (outcome: Outcome) => void;
}) {
  const latest = useRef({ outcomes, onChange });
  const fieldRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    latest.current = { outcomes, onChange };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isOtherField(event.target, fieldRef.current)) return;
      const chosen = latest.current.outcomes[Number(event.key) - 1];
      if (chosen === undefined) return;
      event.preventDefault();
      latest.current.onChange(chosen);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div ref={fieldRef}>
      <SegmentedControl
        value={value ?? null}
        onChange={(chosen) => {
          const outcome = outcomes.find((candidate) => candidate === chosen);
          if (outcome) onChange(outcome);
        }}
      >
        <Label>
          {m.trial_outcome()}{' '}
          <span className="text-muted-foreground">({m.trial_outcome_keys()})</span>
        </Label>
        <SegmentedControlItems className="flex-wrap">
          {outcomes.map((outcome) => (
            <SegmentedControlItem key={outcome} value={outcome}>
              {OUTCOME_LABEL[outcome]()}
            </SegmentedControlItem>
          ))}
        </SegmentedControlItems>
      </SegmentedControl>
    </div>
  );
}

/** What settling the Trial does, as the summary of a gesture says it (spec UX §1). */
export function trialRecap(
  outcome: ReplyTrialOutcome | SettledTrialOutcome,
  state: TrialState,
  windowEndsOn: string | undefined,
  locale: Locale,
) {
  const stage = state.stageName;
  switch (outcome) {
    case 'success':
      return m.trial_recap_success({ stage });
    case 'no_result':
      return m.trial_recap_no_result({ stage });
    case 'canceled':
      return m.trial_recap_canceled({ stage });
    default:
      return windowEndsOn === undefined
        ? m.trial_recap_in_progress_follow_up()
        : m.trial_recap_in_progress({ date: formatLocalDay(windowEndsOn, locale) });
  }
}

/**
 * What the notification of a Trial settled says (spec UX §6.7, §10): the progress of its Battle, as
 * the gesture answered it, never a count of No results (spec UX §1); then what else the gesture did.
 * Canceled or left in progress, only the rest.
 */
export function trialSettledMessage(
  outcome: ReplyTrialOutcome | SettledTrialOutcome | undefined,
  state: TrialState | undefined,
  changes: SummaryChanges,
  then?: string,
): string | undefined {
  if (!state || (outcome !== 'success' && outcome !== 'no_result')) return then;
  // Fallback: an answer from a version from before Battles carries none.
  const answered: SummaryChanges['battles'] | undefined = changes.battles;
  const battle = answered?.find(({ id }) => id === state.battle.id) ?? state.battle;
  const counts = {
    stage: state.stageName,
    finished: battle.finishedTrials,
    started: battle.startedTrials,
  };
  const settled =
    outcome === 'success' ? m.trial_success_toast(counts) : m.trial_no_result_toast(counts);
  return then === undefined ? settled : `${settled} ${then}`;
}

/** After a No result (spec UX §6.7): back to the Pool by default, kept Prospecting, or archived. */
export const NO_RESULT_CHOICES = ['pool', 'prospecting', 'archived'] as const;
export type NoResultChoice = (typeof NO_RESULT_CHOICES)[number];

const NO_RESULT_LABEL: Record<NoResultChoice, () => string> = {
  pool: m.no_result_back_to_pool,
  prospecting: m.no_result_keep,
  archived: m.no_result_archive,
};

/**
 * “Back <Contact> to the Pool?” (spec UX §6.7, §10), after a No result: Back to Pool (preselected),
 * Keep Prospecting, Archive; then the optional reason, unless it stays.
 */
export function NoResultChoiceField({
  name,
  choice,
  reason,
  onChange,
}: {
  name: string;
  choice: NoResultChoice;
  reason: string;
  onChange: (change: { choice?: NoResultChoice; reason?: string }) => void;
}) {
  return (
    <>
      <SegmentedControl
        value={choice}
        onChange={(value) => {
          const chosen = NO_RESULT_CHOICES.find((candidate) => candidate === value);
          if (chosen) onChange({ choice: chosen });
        }}
      >
        <Label>{m.no_result_pool_question({ name })}</Label>
        <SegmentedControlItems className="flex-wrap">
          {NO_RESULT_CHOICES.map((candidate) => (
            <SegmentedControlItem key={candidate} value={candidate}>
              {NO_RESULT_LABEL[candidate]()}
            </SegmentedControlItem>
          ))}
        </SegmentedControlItems>
      </SegmentedControl>
      {choice !== 'prospecting' && (
        <TextField
          value={reason}
          onChange={(text) => onChange({ reason: text })}
          maxLength={STATUS_REASON_MAX_LENGTH}
          className="flex flex-col gap-1.5"
        >
          <Label>{m.change_status_reason()}</Label>
          <Input className="max-md:h-11" />
        </TextField>
      )}
    </>
  );
}

const noResultDraft = z.object({ choice: z.enum(NO_RESULT_CHOICES), reason: z.string() });

/**
 * No result… (spec UX §6.7), from a Trial whose Response window elapsed: the Trial settled with no
 * result, then back to the Pool (preselected), kept Prospecting or archived, the reason optional.
 * `Enter` validates, then “Undo”.
 */
function NoResultPanel({
  contact,
  state,
  summary,
  onClose,
}: {
  contact: SummaryContact;
  state: TrialState;
  summary: Summary;
  onClose: () => void;
}) {
  const locale = useLocale();
  const api = useApi();
  const sendGesture = useSendGesture();
  const { name } = contact;
  const [draft, setDraft, clearDraft] = useSessionDraft(
    `no-result:${contact.id}`,
    { choice: 'pool' as const, reason: '' },
    noResultDraft,
  );
  const status = draft.choice === 'prospecting' ? undefined : draft.choice;
  const close = () => {
    clearDraft();
    onClose();
  };
  const settle = useMutation({
    mutationFn: () => {
      const reason = draft.reason.trim();
      return sendGesture(
        api.contacts[':id']['settle-trial'].$post({
          param: { id: contact.id },
          json: {
            outcome: 'no_result',
            ...(status && { status }),
            ...(status && reason !== '' && { reason }),
          },
        }),
        (changes) => {
          const [changed] = changes.contacts;
          if (!changed) return undefined;
          const then = status && statusChangedMessage(changed, status, summary);
          return trialSettledMessage('no_result', state, changes, then);
        },
      );
    },
    onSuccess: (refused) => {
      if (!refused) close();
    },
  });
  const recap = [trialRecap('no_result', state, undefined, locale)];
  if (status && statusChangeCancelsFollowUp(status) && contact.followUp) {
    recap.push(
      m.change_status_cancels_follow_up({ date: formatLocalDay(contact.followUp.dueOn, locale) }),
    );
  }
  return (
    <GesturePanel title={m.no_result_title({ name })} onClose={close}>
      <EnterSubmits>
        {(formRef) => (
          <Form
            ref={formRef}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (!settle.isPending) settle.mutate();
            }}
          >
            <GesturePanelBody>
              <TrialRecall state={state} />
              <NoResultChoiceField
                name={name}
                choice={draft.choice}
                reason={draft.reason}
                onChange={(change) => setDraft({ ...draft, ...change })}
              />
              <Recap lines={recap} />
              <ErrorMessage>
                {settle.isError ? m.auth_error() : settle.data && m.no_result_behind()}
              </ErrorMessage>
            </GesturePanelBody>
            <GesturePanelFooter>
              <Button type="submit" className="max-md:min-h-11" isDisabled={settle.isPending}>
                {m.no_result_validate()}
              </Button>
            </GesturePanelFooter>
          </Form>
        )}
      </EnterSubmits>
    </GesturePanel>
  );
}

/** The gesture on the Trial open on a record, if any; none once it is settled, elsewhere too. */
export function TrialPanels({
  contact,
  summary,
  gesture,
  onClose,
}: {
  contact: SummaryContact;
  summary: Summary;
  gesture: TrialGesture | undefined;
  onClose: () => void;
}) {
  const state = trialStateOf(contact, summary);
  if (gesture !== 'no-result' || !state) return null;
  return (
    <NoResultPanel
      key={contact.id}
      contact={contact}
      state={state}
      summary={summary}
      onClose={onClose}
    />
  );
}
