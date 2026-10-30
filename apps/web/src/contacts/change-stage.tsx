import { REPLY_TRIAL_OUTCOMES } from '@battlecrm/contract';
import { funnelOf, isInFunnel, nextStageOf, stageMove } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import {
  Button,
  Checkbox,
  ErrorMessage,
  invalidInputClass,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '@battlecrm/ui';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { Form } from 'react-aria-components';
import { z } from 'zod';

import {
  GesturePanel,
  GesturePanelBody,
  GesturePanelFooter,
} from '../components/ui/gesture-panel.tsx';
import { useSendGesture, type RefusalOf } from '../gesture.ts';
import { useLocale, type Locale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';
import { useSessionDraft } from '../session-draft.ts';
import { openBattleAt, positioningsOf, type Summary, type SummaryContact } from '../summary.ts';
import { statusChangedMessage, statusRecap } from './change-status.tsx';
import { EnterSubmits, Recap } from './follow-up.tsx';
import { formatLocalDay } from './format.ts';
import type { StageGesture } from './status.ts';
import {
  trialRecap,
  TrialOutcomeField,
  TrialRecall,
  trialSettledMessage,
  trialStateOf,
  type TrialState,
} from './trial.tsx';
import { cn } from 'cn';

/**
 * The change of Stage open on the record, carried by the address (ST-70): `open` shows its panel,
 * `close` takes it away, `chain` gives way to the central gesture (spec UX §6.1).
 */
export function useStageGesture() {
  const { stageTo } = useSearch({ strict: false });
  const navigate = useNavigate();
  return {
    gesture: stageTo,
    open: (gesture: StageGesture) =>
      void navigate({ to: '.', search: (search) => ({ ...search, stageTo: gesture }) }),
    close: () =>
      void navigate({
        to: '.',
        search: ({ stageTo: _closed, ...search }) => search,
        replace: true,
      }),
    chain: () =>
      void navigate({
        to: '.',
        search: ({ stageTo: _closed, ...search }) => ({ ...search, send: 'positioning' as const }),
        replace: true,
      }),
  };
}

/**
 * What the option of a Stage says, from where the Contact is (spec UX §6.2, §6.6): move on, go back,
 * or stay.
 */
export function stageOptionLabel(summary: Summary, fromId: string | null, toId: string): string {
  const funnel = funnelOf(summary.stages);
  const stage = funnel.find(({ id }) => id === toId)?.name ?? '';
  if (fromId === toId) return m.change_stage_option_stay({ stage });
  const move = fromId === null ? undefined : stageMove(funnel, fromId, toId);
  return move?.forward === false
    ? m.change_stage_option_back({ stage })
    : m.change_stage_option_forward({ stage });
}

/**
 * The Stage a Contact Prospecting moves to, among the ones of the Funnel (spec UX §6.6): each says
 * whether it moves on or goes back; the Stage it is at is offered to stay, when `offersStay` says so.
 */
export function StageMoveField({
  summary,
  fromId,
  stageId,
  onChange,
  isMissing = false,
  offersStay = false,
  takesFocus = false,
  label = m.change_stage_to(),
}: {
  summary: Summary;
  fromId: string | null;
  stageId: string | undefined;
  onChange: (stageId: string | undefined) => void;
  isMissing?: boolean;
  offersStay?: boolean;
  takesFocus?: boolean;
  label?: string;
}) {
  const fieldId = useId();
  const errorId = useId();
  const stages = funnelOf(summary.stages).filter(({ id }) => offersStay || id !== fromId);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <select
        id={fieldId}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- the panel was just opened to change the Stage: its first field takes the focus, which closing gives back.
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
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stageOptionLabel(summary, fromId, stage.id)}
          </option>
        ))}
      </select>
      {isMissing && (
        <div id={errorId}>
          <ErrorMessage>{m.change_status_choose_stage()}</ErrorMessage>
        </div>
      )}
    </div>
  );
}

/**
 * After a Success at the last Stage (spec UX §6.2, §6.6): Add to Circle (preselected), or Stay
 * Prospecting at a Stage.
 */
export const LAST_STAGE_CHOICES = ['circle', 'stay'] as const;
export type LastStageChoice = (typeof LAST_STAGE_CHOICES)[number];

/** Whether a Trial settled as it is ends the Funnel: a Success in a Battle of its last Stage. */
export const endsFunnel = (summary: Summary, state: TrialState, outcome: string | undefined) =>
  outcome === 'success' && funnelOf(summary.stages).at(-1)?.id === state.battle.stageId;

export function LastStageField({
  name,
  stageName,
  choice,
  onChange,
}: {
  name: string;
  stageName: string;
  choice: LastStageChoice;
  onChange: (choice: LastStageChoice) => void;
}) {
  return (
    <SegmentedControl
      value={choice}
      onChange={(value) => {
        const chosen = LAST_STAGE_CHOICES.find((candidate) => candidate === value);
        if (chosen) onChange(chosen);
      }}
    >
      <Label>{m.last_stage_question({ name })}</Label>
      <SegmentedControlItems className="flex-wrap">
        <SegmentedControlItem value="circle">{m.last_stage_add_to_circle()}</SegmentedControlItem>
        <SegmentedControlItem value="stay">
          {m.last_stage_stay({ stage: stageName })}
        </SegmentedControlItem>
      </SegmentedControlItems>
    </SegmentedControl>
  );
}

/**
 * What the arrival Stage offers next (spec UX §6.6): with an open Battle, the chain to the central
 * gesture (checked); otherwise a line on the Positionings available there.
 */
export function ChainField({
  summary,
  stageId,
  isChecked,
  onChange,
}: {
  summary: Summary;
  stageId: string;
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
}) {
  if (openBattleAt(summary, stageId)) {
    return (
      <Checkbox isSelected={isChecked} onChange={onChange} className="max-md:min-h-11">
        {m.change_stage_chain()}
      </Checkbox>
    );
  }
  const stage = summary.stages.find(({ id }) => id === stageId)?.name ?? '';
  const count = positioningsOf(summary).filter(
    (positioning) => positioning.stageId === stageId && !positioning.archived,
  ).length;
  return (
    <p className="text-muted-foreground">
      {count === 0
        ? m.change_stage_no_positioning({ stage })
        : m.change_stage_positionings({ stage, count })}
    </p>
  );
}

/** Whether a gesture moving a Contact to this Stage chains to the central gesture: an open Battle there. */
export const chainsAt = (summary: Summary, stageId: string | undefined, isChecked: boolean) =>
  isChecked && stageId !== undefined && openBattleAt(summary, stageId) !== undefined;

/** What the notification of a change of Stage says (spec UX §10): moving on, or going back. */
export function stageChangedMessage(
  summary: Summary,
  name: string,
  fromId: string | null,
  toId: string,
): string {
  const funnel = funnelOf(summary.stages);
  const stage = funnel.find(({ id }) => id === toId)?.name ?? '';
  const move = fromId === null ? undefined : stageMove(funnel, fromId, toId);
  return move?.forward === false
    ? m.stage_changed_back({ name, stage })
    : m.stage_changed_forward({ name, stage });
}

/** The recap line of a change of Stage: a step forward, or a step back, said as such (spec UX §6.6). */
export function stageMoveRecap(summary: Summary, fromId: string | null, toId: string) {
  const funnel = funnelOf(summary.stages);
  const move = fromId === null ? undefined : stageMove(funnel, fromId, toId);
  if (!move) return undefined;
  const names = {
    from: funnel[move.fromPosition]?.name ?? '',
    to: funnel[move.toPosition]?.name ?? '',
  };
  return move.forward ? m.change_stage_forward(names) : m.change_stage_back(names);
}

/** The line that cancels the scheduled Follow-up (spec UX §6.2, §6.6). */
export function cancelFollowUpLabel(
  followUp: NonNullable<SummaryContact['followUp']>,
  locale: Locale,
) {
  const date = formatLocalDay(followUp.dueOn, locale);
  return followUp.rank == null
    ? m.reply_cancel_follow_up({ date })
    : m.reply_cancel_follow_up_rank({ rank: followUp.rank, date });
}

const draftSchema = z.object({
  stageId: z.string().optional(),
  trialOutcome: z.enum(REPLY_TRIAL_OUTCOMES).optional(),
  cancelFollowUp: z.boolean(),
  chain: z.boolean(),
  lastStage: z.enum(LAST_STAGE_CHOICES),
});
type Draft = z.infer<typeof draftSchema>;

type StageRefusal =
  | RefusalOf<ApiClient['contacts'][':id']['change-stage']['$post']>
  | RefusalOf<ApiClient['contacts'][':id']['change-status']['$post']>;

/**
 * Change stage… (spec UX §6.6): the Stage a Contact Prospecting moves to, the next one by default;
 * its Trial in progress settled first, a Success proposed moving on, left in progress going back;
 * once settled, its Follow-up canceled (checked). A Success at the last Stage proposes the Circle
 * instead. An open Battle at the arrival chains to the central gesture (checked). `Enter` validates,
 * then “Undo”.
 */
export function ChangeStagePanel({
  contact,
  summary,
  gesture,
  onClose,
  onChain,
}: {
  contact: SummaryContact;
  summary: Summary;
  gesture: StageGesture;
  onClose: () => void;
  onChain: () => void;
}) {
  const locale = useLocale();
  const api = useApi();
  const sendGesture = useSendGesture();
  const funnel = funnelOf(summary.stages);
  const fromId = contact.stageId;
  const opened = gesture !== 'choose' && gesture !== fromId ? gesture : undefined;
  const [draft, setDraft, clearDraft] = useSessionDraft<Draft>(
    `change-stage:${contact.id}`,
    {
      stageId: opened ?? nextStageOf(funnel, fromId)?.id,
      cancelFollowUp: true,
      chain: true,
      lastStage: 'circle',
    },
    draftSchema,
  );
  const [wasSent, setWasSent] = useState(false);
  // Archived meanwhile, or the Stage it is at now, the Stage is to be chosen again.
  const stageId =
    draft.stageId !== fromId && isInFunnel(funnel, draft.stageId) ? draft.stageId : undefined;
  const move = stageId && fromId ? stageMove(funnel, fromId, stageId) : undefined;
  const trial = trialStateOf(contact, summary);
  const proposed = move && (move.forward ? 'success' : 'in_progress');
  const trialOutcome = trial && (draft.trialOutcome ?? proposed);
  const isSettled = trialOutcome === 'success' || trialOutcome === 'no_result';
  const toCircle =
    trial !== undefined && endsFunnel(summary, trial, trialOutcome) && draft.lastStage === 'circle';
  const offersCancel = !toCircle && isSettled && contact.followUp !== null;
  const cancelsFollowUp = offersCancel && draft.cancelFollowUp;
  const chains = !toCircle && chainsAt(summary, stageId, draft.chain);
  const isTrialUnsettled = trial !== undefined && trialOutcome === undefined;
  const isStageMissing = !toCircle && stageId === undefined;

  const close = () => {
    clearDraft();
    onClose();
  };

  const change = useMutation({
    mutationFn: async (): Promise<StageRefusal | undefined> => {
      if (toCircle) {
        return sendGesture(
          api.contacts[':id']['change-status'].$post({
            param: { id: contact.id },
            json: { status: 'ally', trialOutcome: 'success' },
          }),
          (changes) => {
            const [changed] = changes.contacts;
            if (!changed) return undefined;
            const then = statusChangedMessage(changed, 'ally', summary);
            return trialSettledMessage('success', trial, changes, then);
          },
        );
      }
      if (stageId === undefined) return undefined;
      return sendGesture(
        api.contacts[':id']['change-stage'].$post({
          param: { id: contact.id },
          json: {
            stageId,
            ...(trialOutcome && { trialOutcome }),
            ...(cancelsFollowUp && { cancelFollowUp: true }),
          },
        }),
        (changes) => {
          if (!changes.contacts[0]) return undefined;
          const then = stageChangedMessage(summary, contact.name, fromId, stageId);
          return trialSettledMessage(trialOutcome, trial, changes, then);
        },
      );
    },
    onSuccess: (refused) => {
      if (refused) {
        if (refused.error === 'unknown_stage') setDraft({ ...draft, stageId: undefined });
        return;
      }
      clearDraft();
      if (chains) onChain();
      else onClose();
    },
  });

  const recap: string[] = [];
  if (toCircle) {
    if (trial) recap.push(trialRecap('success', trial, undefined, locale));
    recap.push(...statusRecap('ally', summary, locale));
    if (contact.followUp) {
      recap.push(
        m.change_status_cancels_follow_up({
          date: formatLocalDay(contact.followUp.dueOn, locale),
        }),
      );
    }
  } else {
    const line = stageId && stageMoveRecap(summary, fromId, stageId);
    if (line) recap.push(line);
    if (trial && trialOutcome) recap.push(trialRecap(trialOutcome, trial, trial.endsOn, locale));
    if (cancelsFollowUp && contact.followUp) {
      recap.push(
        m.change_status_cancels_follow_up({
          date: formatLocalDay(contact.followUp.dueOn, locale),
        }),
      );
    }
  }

  const refused = change.data;
  return (
    <GesturePanel title={m.change_stage_title({ name: contact.name })} onClose={close}>
      <EnterSubmits>
        {(formRef) => (
          <Form
            ref={formRef}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              setWasSent(true);
              if (isStageMissing || isTrialUnsettled || change.isPending) return;
              change.mutate();
            }}
          >
            <GesturePanelBody>
              <StageMoveField
                summary={summary}
                fromId={fromId}
                stageId={stageId}
                onChange={(chosen) => setDraft({ ...draft, stageId: chosen })}
                isMissing={wasSent && isStageMissing}
                takesFocus
              />
              {trial && (
                <>
                  <TrialRecall state={trial} />
                  <TrialOutcomeField
                    outcomes={REPLY_TRIAL_OUTCOMES}
                    value={trialOutcome}
                    onChange={(outcome) => setDraft({ ...draft, trialOutcome: outcome })}
                  />
                  {endsFunnel(summary, trial, trialOutcome) && (
                    <LastStageField
                      name={contact.name}
                      stageName={funnel.find(({ id }) => id === (stageId ?? fromId))?.name ?? ''}
                      choice={draft.lastStage}
                      onChange={(lastStage) => setDraft({ ...draft, lastStage })}
                    />
                  )}
                </>
              )}
              {offersCancel && contact.followUp && (
                <Checkbox
                  isSelected={draft.cancelFollowUp}
                  onChange={(cancelFollowUp) => setDraft({ ...draft, cancelFollowUp })}
                  className="max-md:min-h-11"
                >
                  {cancelFollowUpLabel(contact.followUp, locale)}
                </Checkbox>
              )}
              {!toCircle && stageId !== undefined && (
                <ChainField
                  summary={summary}
                  stageId={stageId}
                  isChecked={draft.chain}
                  onChange={(chain) => setDraft({ ...draft, chain })}
                />
              )}
              {recap.length > 0 && <Recap lines={recap} />}
              <ErrorMessage>
                {change.isError
                  ? m.auth_error()
                  : refused &&
                    (refused.error === 'unknown_stage'
                      ? m.contact_stage_gone()
                      : m.change_stage_behind())}
              </ErrorMessage>
            </GesturePanelBody>
            <GesturePanelFooter>
              <Button
                type="submit"
                className="max-md:min-h-11"
                isDisabled={isTrialUnsettled || change.isPending}
              >
                {toCircle ? m.last_stage_add_to_circle() : m.change_stage_validate()}
              </Button>
            </GesturePanelFooter>
          </Form>
        )}
      </EnterSubmits>
    </GesturePanel>
  );
}
