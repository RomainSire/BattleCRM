import {
  CANCEL_REASON_MAX_LENGTH,
  CONTACT_STATUSES,
  SETTLED_TRIAL_OUTCOMES,
  STATUS_REASON_MAX_LENGTH,
  type ContactStatus,
  type SettledTrialOutcome,
} from '@battlecrm/contract';
import {
  addDays,
  funnelEntriesInWeek,
  funnelOf,
  stageToEnter,
  statusChangeCancelsFollowUp,
} from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useMutation } from '@tanstack/react-query';
import { cn } from 'cn';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useId, useRef, useState } from 'react';
import { Form, TextField } from 'react-aria-components';
import { z } from 'zod';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage, FieldErrorMessage } from '../components/ui/error-message.tsx';
import {
  GesturePanel,
  GesturePanelBody,
  GesturePanelFooter,
} from '../components/ui/gesture-panel.tsx';
import { Input, invalidInputClass } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '../components/ui/segmented-control.tsx';
import { useSendGesture, type RefusalOf } from '../gesture.ts';
import { useLocale, type Locale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';
import { useSessionDraft } from '../session-draft.ts';
import { settingsOf } from '../settings/use-settings.ts';
import { todayOf, type Summary, type SummaryContact } from '../summary.ts';
import { formatLocalDay } from './format.ts';
import { otherStatuses, STATUS_ACTION, type StatusGesture } from './status.ts';
import {
  trialRecap,
  TrialOutcomeField,
  TrialRecall,
  trialSettledMessage,
  trialStateOf,
} from './trial.tsx';

/**
 * The change of Status open on the record, carried by the address (ST-70): `open` shows its panel,
 * `close` takes it away.
 */
export function useStatusGesture() {
  const { statusTo } = useSearch({ strict: false });
  const navigate = useNavigate();
  return {
    gesture: statusTo,
    open: (gesture: StatusGesture) =>
      void navigate({ to: '.', search: (search) => ({ ...search, statusTo: gesture }) }),
    close: () =>
      void navigate({
        to: '.',
        search: ({ statusTo: _closed, ...search }) => search,
        replace: true,
      }),
  };
}

const TITLE: Record<StatusGesture, (inputs: { name: string }) => string> = {
  choose: m.change_status_title_choose,
  prospecting: m.change_status_title_prospecting,
  ally: m.change_status_title_ally,
  pool: m.change_status_title_pool,
  archived: m.change_status_title_archived,
};

/** A Stage the server refuses has to be chosen again. */
const isStageGone = ({
  error,
}: RefusalOf<ApiClient['contacts'][':id']['change-status']['$post']>) =>
  error === 'stage_required' || error === 'unknown_stage';

/** What the panel keeps while it is open: the target when it was to be chosen, the Stage, the reason. */
const draftSchema = z.object({
  target: z.enum(CONTACT_STATUSES).optional(),
  stageId: z.string().optional(),
  reason: z.string(),
  trialOutcome: z.enum(SETTLED_TRIAL_OUTCOMES).optional(),
  cancelReason: z.string().optional(),
});

/**
 * The outcome proposed for the Trial in progress when the Contact leaves Prospecting (spec UX
 * §6.11): a Success to the Circle, a No result to the Pool, none to Archived.
 */
const PROPOSED_OUTCOME: Partial<Record<ContactStatus, SettledTrialOutcome>> = {
  ally: 'success',
  pool: 'no_result',
};
type Draft = z.infer<typeof draftSchema>;

/**
 * Bring in…, Back to Pool…, Add to Circle…, Archive…, or Change status… which chooses the target
 * first (spec UX §6.11): one panel, set to its target. The Stage to enter, the reason, the summary;
 * `Enter` validates, then “Undo”. Leaving Prospecting settles the Trial in progress: a Success, a No
 * result, or canceled with its reason.
 */
export function ChangeStatusPanel({
  contact,
  summary,
  gesture,
  onClose,
}: {
  contact: SummaryContact;
  summary: Summary;
  gesture: StatusGesture;
  onClose: () => void;
}) {
  const locale = useLocale();
  const api = useApi();
  const sendGesture = useSendGesture();
  const formRef = useRef<HTMLFormElement>(null);
  // A target the Contact already has, from an address kept from before, is to be chosen again.
  const opened: StatusGesture = gesture === contact.status ? 'choose' : gesture;
  const lastStage = summary.stages.find(({ id }) => id === contact.stageId);
  const [draft, setDraft, clearDraft] = useSessionDraft<Draft>(
    `change-status:${contact.id}:${opened}`,
    // By default, the last Stage it reached, while the Funnel has it.
    { stageId: stageToEnter(funnelOf(summary.stages), { last: contact.stageId }), reason: '' },
    draftSchema,
  );
  const target = opened === 'choose' ? draft.target : opened;
  const [wasSent, setWasSent] = useState(false);
  // Archived meanwhile, the Stage chosen is to be chosen again.
  const stageId = stageToEnter(funnelOf(summary.stages), { chosen: draft.stageId });
  const isStageMissing = target === 'prospecting' && stageId === undefined;
  // Leaving Prospecting settles the Trial in progress (spec UX §6.11).
  const trial =
    target !== undefined && target !== 'prospecting' && contact.status === 'prospecting'
      ? trialStateOf(contact, summary)
      : undefined;
  const trialOutcome = trial && (draft.trialOutcome ?? (target && PROPOSED_OUTCOME[target]));
  const cancelReason = draft.cancelReason?.trim() ?? '';
  const isTrialUnsettled = trial !== undefined && trialOutcome === undefined;
  const isCancelReasonMissing = trialOutcome === 'canceled' && cancelReason === '';

  const close = () => {
    clearDraft();
    onClose();
  };

  const change = useMutation({
    mutationFn: (to: ContactStatus) => {
      const reason = draft.reason.trim();
      return sendGesture(
        api.contacts[':id']['change-status'].$post({
          param: { id: contact.id },
          json: {
            status: to,
            ...(to === 'prospecting' && stageId !== undefined && { stageId }),
            ...(reason !== '' && { reason }),
            ...(trialOutcome && { trialOutcome }),
            ...(trialOutcome === 'canceled' && { cancelReason }),
          },
        }),
        (changes) => {
          const [changed] = changes.contacts;
          if (!changed) return undefined;
          const then = statusChangedMessage(changed, to, summary);
          return trialSettledMessage(trialOutcome, trial, changes, then);
        },
      );
    },
    onSuccess: (refused) => {
      if (!refused) close();
      else if (isStageGone(refused)) setDraft({ ...draft, stageId: undefined });
    },
  });

  /** The summary of what the change does (spec UX §1, §6.11). */
  const recap = target === undefined ? [] : statusRecap(target, summary, locale);
  if (trial && trialOutcome) recap.unshift(trialRecap(trialOutcome, trial, undefined, locale));
  if (target === 'ally' && contact.status === 'prospecting' && lastStage) {
    recap.push(m.change_status_keeps_stage({ stage: lastStage.name }));
  }
  if (target !== undefined && statusChangeCancelsFollowUp(target) && contact.followUp) {
    recap.push(
      m.change_status_cancels_follow_up({ date: formatLocalDay(contact.followUp.dueOn, locale) }),
    );
  }

  return (
    <GesturePanel title={TITLE[opened]({ name: contact.name })} onClose={close}>
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- `Enter` validates from any field (spec UX §6.11): a list of Stages or a choice of target would not submit by itself. */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.target instanceof HTMLButtonElement) return;
          if (event.target instanceof HTMLInputElement && event.target.type === 'text') return;
          event.preventDefault();
          formRef.current?.requestSubmit();
        }}
      >
        <Form
          className="flex min-h-0 flex-1 flex-col"
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            setWasSent(true);
            if (
              target === undefined ||
              isStageMissing ||
              isTrialUnsettled ||
              isCancelReasonMissing ||
              change.isPending
            ) {
              return;
            }
            change.mutate(target);
          }}
        >
          <GesturePanelBody>
            {opened === 'choose' && (
              <SegmentedControl
                value={draft.target ?? null}
                onChange={(value) => {
                  const chosen = CONTACT_STATUSES.find((candidate) => candidate === value);
                  if (chosen) setDraft({ ...draft, target: chosen });
                }}
              >
                <Label>{m.change_status_target()}</Label>
                <SegmentedControlItems className="flex-wrap">
                  {otherStatuses(contact.status).map((candidate) => (
                    <SegmentedControlItem key={candidate} value={candidate}>
                      {STATUS_ACTION[candidate]()}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControlItems>
              </SegmentedControl>
            )}
            {target === 'prospecting' && (
              <StageField
                summary={summary}
                stageId={stageId}
                onChange={(chosen) => setDraft({ ...draft, stageId: chosen })}
                isMissing={wasSent && isStageMissing}
                takesFocus={opened !== 'choose'}
              />
            )}
            {target !== undefined && (
              <TextField
                name="reason"
                value={draft.reason}
                onChange={(reason) => setDraft({ ...draft, reason })}
                maxLength={STATUS_REASON_MAX_LENGTH}
                className="flex flex-col gap-1.5"
              >
                <Label>{m.change_status_reason()}</Label>
                <Input
                  // oxlint-disable-next-line jsx-a11y/no-autofocus -- the panel was just opened: its first field takes the focus, which closing gives back.
                  autoFocus={opened !== 'choose' && target !== 'prospecting'}
                  className="max-md:h-11"
                />
              </TextField>
            )}
            {trial && (
              <>
                <TrialRecall state={trial} />
                <TrialOutcomeField
                  outcomes={SETTLED_TRIAL_OUTCOMES}
                  value={trialOutcome}
                  onChange={(outcome) => setDraft({ ...draft, trialOutcome: outcome })}
                />
                {trialOutcome === 'canceled' && (
                  <TextField
                    value={draft.cancelReason ?? ''}
                    onChange={(text) => setDraft({ ...draft, cancelReason: text })}
                    maxLength={CANCEL_REASON_MAX_LENGTH}
                    isInvalid={wasSent && isCancelReasonMissing}
                    className="flex flex-col gap-1.5"
                  >
                    <Label>{m.trial_cancel_reason()}</Label>
                    <Input className="max-md:h-11" />
                    <FieldErrorMessage>{m.trial_cancel_reason_required()}</FieldErrorMessage>
                  </TextField>
                )}
              </>
            )}
            {recap.length > 0 && (
              <section aria-label={m.change_status_recap()} className="rounded-control border p-3">
                <ul className="list-disc pl-5">
                  {recap.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            )}
            <ErrorMessage>
              {change.isError
                ? m.auth_error()
                : change.data &&
                  // Data this device is behind on, changed on another one.
                  (isStageGone(change.data)
                    ? m.contact_stage_gone()
                    : change.data.error === 'trial_in_progress'
                      ? m.change_status_trial_in_progress({ name: contact.name })
                      : m.change_status_behind())}
            </ErrorMessage>
          </GesturePanelBody>
          <GesturePanelFooter>
            <Button
              type="submit"
              className="max-md:min-h-11"
              isDisabled={target === undefined || isTrialUnsettled || change.isPending}
            >
              {target === undefined ? m.change_status_validate() : STATUS_ACTION[target]()}
            </Button>
          </GesturePanelFooter>
        </Form>
      </div>
    </GesturePanel>
  );
}

/** The Stage a Contact enters the Funnel at, among the ones not archived; required when none is chosen. */
export function StageField({
  summary,
  stageId,
  onChange,
  isMissing,
  takesFocus = false,
}: {
  summary: Summary;
  stageId: string | undefined;
  onChange: (stageId: string | undefined) => void;
  isMissing: boolean;
  takesFocus?: boolean;
}) {
  const fieldId = useId();
  const errorId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>{m.contact_stage()}</Label>
      <select
        id={fieldId}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- the panel was just opened to enter the Funnel: its first field takes the focus, which closing gives back.
        autoFocus={takesFocus}
        value={stageId ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
        aria-invalid={isMissing}
        aria-describedby={isMissing ? errorId : undefined}
        className={cn(
          'h-8 w-full rounded-control border border-input bg-background px-2 text-base focus-ring max-md:h-11 md:text-sm',
          isMissing && invalidInputClass,
        )}
      >
        {stageId === undefined && <option value="">{m.change_status_choose_stage()}</option>}
        {funnelOf(summary.stages).map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </select>
      {isMissing && (
        <div id={errorId}>
          <ErrorMessage>{m.change_status_stage_required()}</ErrorMessage>
        </div>
      )}
    </div>
  );
}

/**
 * What entering the Funnel or the Circle counts (spec UX §6.11): the Funnel entry of this week against
 * its goal, the Circle against its size goal and the next check-in, a Rhythm after the last Interaction
 * done (today unless said otherwise). Nothing for the other Statuses.
 */
export function statusRecap(
  to: ContactStatus,
  summary: Summary,
  locale: Locale,
  lastDoneOn?: string,
): string[] {
  const today = todayOf(summary);
  // The Entry goal of this week, whatever the User chose for the next ones; either may be off.
  const settings = settingsOf(summary);
  if (to === 'prospecting') {
    const count = funnelEntriesInWeek(summary.contacts, today) + 1;
    const goal = settings.entryGoal.inEffect;
    return [
      goal === null
        ? m.change_status_entry_recap_no_goal({ count })
        : m.change_status_entry_recap({ count, goal }),
    ];
  }
  if (to !== 'ally') return [];
  const count = circleCountAfter(summary);
  const goal = settings.circleSizeGoal;
  const days = settings.checkInRhythmDays;
  const date = formatLocalDay(addDays(lastDoneOn ?? today, days), locale);
  return [
    goal === null
      ? m.change_status_circle_recap_no_goal({ count, date, days })
      : m.change_status_circle_recap({ count, goal, date, days }),
  ];
}

/** The Allies once one more joins the Circle. */
const circleCountAfter = (summary: Summary) =>
  summary.contacts.filter(({ status }) => status === 'ally').length + 1;

/** What the notification of a change of Status says (spec UX §10), with the counts the summary showed before it. */
export function statusChangedMessage(
  changed: SummaryContact,
  to: ContactStatus,
  summary: Summary,
): string {
  const { name } = changed;
  const settings = settingsOf(summary);
  switch (to) {
    case 'prospecting': {
      const stage = summary.stages.find(({ id }) => id === changed.stageId)?.name ?? '';
      const count = funnelEntriesInWeek(summary.contacts, todayOf(summary)) + 1;
      const goal = settings.entryGoal.inEffect;
      return goal === null
        ? m.status_changed_prospecting_no_goal({ name, stage, count })
        : m.status_changed_prospecting({ name, stage, count, goal });
    }
    case 'ally': {
      const count = circleCountAfter(summary);
      const goal = settings.circleSizeGoal;
      return goal === null
        ? m.status_changed_ally_no_goal({ name, count })
        : m.status_changed_ally({ name, count, goal });
    }
    case 'pool':
      return m.status_changed_pool({ name });
    default:
      return m.status_changed_archived({ name });
  }
}
