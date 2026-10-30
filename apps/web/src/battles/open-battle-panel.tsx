import {
  BATTLE_HORIZON_MAX,
  BATTLE_MINIMUM_FINISHED,
  BATTLE_MINIMUM_SUCCESSES,
  BATTLE_THRESHOLDS,
  DEFAULT_BATTLE_HORIZON,
  DEFAULT_BATTLE_THRESHOLD,
  SUCCESS_CRITERION_MAX_LENGTH,
  TARGETS,
  type BattleTarget,
} from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import {
  Button,
  ErrorMessage,
  FieldErrorMessage,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '@battlecrm/ui';
import { useMutation } from '@tanstack/react-query';
import { cn } from 'cn';
import { useId, useState } from 'react';
import { Form, NumberField, TextField } from 'react-aria-components';
import { z } from 'zod';

import {
  GesturePanel,
  GesturePanelBody,
  GesturePanelFooter,
} from '../components/ui/gesture-panel.tsx';
import { useSendGesture, type RefusalOf } from '../gesture.ts';
import { PositioningPanel } from '../positionings/positioning-panel.tsx';
import { useApi, type ApiClient } from '../session.ts';
import { useSessionDraft } from '../session-draft.ts';
import {
  championAt,
  lastBattleAt,
  positioningsOf,
  type Summary,
  type SummaryPositioning,
} from '../summary.ts';

/**
 * The panels of the Battles screen, carried by the address (ST-70): the progress of an open Battle,
 * or an opening, its wizard or the creation of a Challenger.
 */
export const BATTLE_PANELS = ['progress', 'close', 'open', 'new-positioning'] as const;
export type BattlePanel = (typeof BATTLE_PANELS)[number];
export type OpeningPanel = Exclude<BattlePanel, 'progress' | 'close'>;

type Stage = Summary['stages'][number];

/** “All Targets”, as the wizard chooses it: no restriction. */
export const ALL_TARGETS = 'all';
const targetChoice = z.enum([ALL_TARGETS, ...TARGETS]);

const openingDraft = z.object({
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  championId: z.string(),
  challengerId: z.string(),
  successCriterion: z.string(),
  target: targetChoice,
  threshold: z.number(),
  horizon: z.number(),
});
type OpeningDraft = z.infer<typeof openingDraft>;

/**
 * The opening under way at a Stage, kept in `sessionStorage` (ST-70): the wizard and the creation of
 * a Challenger it leads to share it. Its Success criterion starts from the last Battle of the Stage,
 * otherwise from its Aim (spec UX §6.9).
 */
function useOpeningDraft(summary: Summary, stage: Stage) {
  return useSessionDraft<OpeningDraft>(
    `battle:open:${stage.id}`,
    {
      step: 1,
      championId: '',
      challengerId: '',
      successCriterion: lastBattleAt(summary, stage.id)?.successCriterion ?? stage.aim ?? '',
      target: ALL_TARGETS,
      threshold: DEFAULT_BATTLE_THRESHOLD,
      horizon: DEFAULT_BATTLE_HORIZON,
    },
    openingDraft,
  );
}

/** What each Target restriction reads as, in the field and in the recap. */
export const TARGET_OPTION = {
  [ALL_TARGETS]: m.battle_target_all,
  consultancy: m.battle_target_consultancy,
  end_client: m.battle_target_end_client,
  unknown: m.battle_target_unknown,
};
const TARGET_RECAP: Record<BattleTarget, () => string> = {
  consultancy: m.battle_recap_consultancy,
  end_client: m.battle_recap_end_client,
  unknown: m.battle_recap_unknown,
};

/** A threshold as a percentage: “85 %”. */
const percent = (threshold: number) => m.battle_percent({ percent: Math.round(threshold * 100) });

type OpenRefusal = RefusalOf<ApiClient['battles']['$post']>;

/** What a refusal tells the User: a Stage gone, a Battle open meanwhile, or the summary behind. */
function refusalText(refused: OpenRefusal | undefined) {
  if (refused === undefined) return undefined;
  if (refused.error === 'unknown_stage') return m.contact_stage_gone();
  if (refused.error === 'battle_open') return m.battle_already_open();
  return m.battle_behind();
}

/** The opening of a Battle at a Stage (spec UX §6.9): the wizard, or the creation of a Challenger it leads to. */
export function OpenBattlePanels({
  summary,
  stage,
  panel,
  onPanel,
  onClose,
}: {
  summary: Summary;
  stage: Stage;
  panel: OpeningPanel;
  onPanel: (panel: OpeningPanel) => void;
  onClose: () => void;
}) {
  if (panel === 'new-positioning') {
    return <CreateChallenger summary={summary} stage={stage} onBack={() => onPanel('open')} />;
  }
  return (
    <OpenBattlePanel
      summary={summary}
      stage={stage}
      onClose={onClose}
      onCreatePositioning={() => onPanel('new-positioning')}
    />
  );
}

/**
 * The wizard in three steps (spec UX §6.9): who faces whom, the Success criterion, then the rules,
 * fixed once open, and a recap in one sentence.
 */
function OpenBattlePanel({
  summary,
  stage,
  onClose,
  onCreatePositioning,
}: {
  summary: Summary;
  stage: Stage;
  onClose: () => void;
  onCreatePositioning: () => void;
}) {
  const api = useApi();
  const sendGesture = useSendGesture();
  const [draft, setDraft, clearDraft] = useOpeningDraft(summary, stage);
  const [wasSent, setWasSent] = useState(false);
  const champion = championAt(summary, stage.id);
  const atStage = positioningsOf(summary).filter(({ stageId }) => stageId === stage.id);
  const championId = champion?.id ?? draft.championId;
  const candidates = atStage.filter(({ archived }) => !archived);
  const challengers = atStage.filter(({ id }) => id !== championId);
  const chosenChallenger = challengers.find(({ id }) => id === draft.challengerId);
  const labelOf = (id: string) => atStage.find((row) => row.id === id)?.label ?? '…';
  const criterion = draft.successCriterion.trim();

  const close = () => {
    clearDraft();
    onClose();
  };
  const openBattle = useMutation({
    mutationFn: () =>
      sendGesture(
        api.battles.$post({
          json: {
            stageId: stage.id,
            ...(champion === undefined && { championId }),
            challengerId: draft.challengerId,
            successCriterion: criterion,
            target: draft.target === ALL_TARGETS ? null : draft.target,
            threshold:
              BATTLE_THRESHOLDS.find((threshold) => threshold === draft.threshold) ??
              DEFAULT_BATTLE_THRESHOLD,
            horizon: draft.horizon,
          },
        }),
        () =>
          m.battle_opened_toast({
            stage: stage.name,
            champion: labelOf(championId),
            challenger: labelOf(draft.challengerId),
          }),
      ),
    onSuccess: (refused) => {
      if (refused) return;
      close();
    },
  });

  const steps = [m.battle_step_opponents(), m.battle_step_criterion(), m.battle_step_rules()];
  const canGoOn =
    draft.step === 1 ? championId !== '' && chosenChallenger !== undefined : criterion !== '';
  const goTo = (step: OpeningDraft['step']) => setDraft({ ...draft, step });

  return (
    <GesturePanel title={m.battle_open_title({ stage: stage.name })} onClose={close}>
      <Form
        className="flex min-h-0 flex-1 flex-col"
        validationBehavior="aria"
        onSubmit={(event) => {
          event.preventDefault();
          setWasSent(true);
          if (!canGoOn) return;
          if (draft.step === 1) goTo(2);
          else if (draft.step === 2) goTo(3);
          else if (!openBattle.isPending) openBattle.mutate();
        }}
      >
        <GesturePanelBody>
          <ol className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {steps.map((label, index) => (
              <li
                key={label}
                aria-current={index + 1 === draft.step ? 'step' : undefined}
                className={cn(
                  'text-muted-foreground',
                  index + 1 === draft.step && 'font-medium text-foreground',
                )}
              >
                {index + 1}. {label}
              </li>
            ))}
          </ol>
          {draft.step === 1 && (
            <OpponentsStep
              atStage={atStage}
              champion={champion}
              candidates={candidates}
              challengers={challengers}
              draft={draft}
              setDraft={setDraft}
              onCreatePositioning={onCreatePositioning}
            />
          )}
          {draft.step === 2 && (
            <TextField
              value={draft.successCriterion}
              onChange={(successCriterion) => setDraft({ ...draft, successCriterion })}
              maxLength={SUCCESS_CRITERION_MAX_LENGTH}
              isInvalid={wasSent && criterion === ''}
              className="flex flex-col gap-1.5"
            >
              <Label>{m.battle_criterion()}</Label>
              <Input
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- the step was just shown: its only field takes the focus.
                autoFocus
                placeholder={m.battle_criterion_placeholder()}
                className="max-md:h-11"
              />
              <p className="text-sm text-muted-foreground">{m.battle_criterion_hint()}</p>
              <FieldErrorMessage>{m.battle_criterion_required()}</FieldErrorMessage>
            </TextField>
          )}
          {draft.step === 3 && (
            <RulesStep
              stageName={stage.name}
              champion={labelOf(championId)}
              challenger={labelOf(draft.challengerId)}
              criterion={criterion}
              draft={draft}
              setDraft={setDraft}
            />
          )}
          <ErrorMessage>
            {openBattle.isError ? m.auth_error() : refusalText(openBattle.data)}
          </ErrorMessage>
        </GesturePanelBody>
        <GesturePanelFooter>
          {draft.step === 1 ? (
            <Button variant="outline" className="max-md:min-h-11" onPress={close}>
              {m.cancel()}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="max-md:min-h-11"
              onPress={() => goTo(draft.step === 3 ? 2 : 1)}
            >
              {m.battle_back()}
            </Button>
          )}
          <Button
            type="submit"
            className="max-md:min-h-11"
            isDisabled={!canGoOn || openBattle.isPending}
          >
            {draft.step === 3 ? m.battle_open_validate() : m.battle_next()}
          </Button>
        </GesturePanelFooter>
      </Form>
    </GesturePanel>
  );
}

/** Step 1: the Champion, or the initial Champion to designate, against a Challenger of the Stage. */
function OpponentsStep({
  atStage,
  champion,
  candidates,
  challengers,
  draft,
  setDraft,
  onCreatePositioning,
}: {
  atStage: SummaryPositioning[];
  champion: SummaryPositioning | undefined;
  candidates: SummaryPositioning[];
  challengers: SummaryPositioning[];
  draft: OpeningDraft;
  setDraft: (draft: OpeningDraft) => void;
  onCreatePositioning: () => void;
}) {
  const create = (
    <Button
      variant="link"
      className="h-auto w-fit p-0 max-md:min-h-11"
      onPress={onCreatePositioning}
    >
      {m.battle_create_positioning()}
    </Button>
  );
  if (atStage.length < 2) {
    return (
      <>
        <p>{m.battle_needs_two()}</p>
        {create}
      </>
    );
  }
  return (
    <>
      {champion ? (
        <p>
          <span className="text-muted-foreground">{m.battle_champion()} · </span>
          <span className="font-medium">{champion.label}</span>
        </p>
      ) : (
        <SegmentedControl
          value={draft.championId}
          onChange={(championId) =>
            setDraft({
              ...draft,
              championId,
              // Never against itself.
              challengerId: draft.challengerId === championId ? '' : draft.challengerId,
            })
          }
        >
          <Label>{m.battle_initial_champion()}</Label>
          <p className="text-sm text-muted-foreground">{m.battle_initial_champion_hint()}</p>
          <SegmentedControlItems className="flex-wrap">
            {candidates.map((positioning) => (
              <SegmentedControlItem key={positioning.id} value={positioning.id}>
                {positioning.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControlItems>
        </SegmentedControl>
      )}
      <SegmentedControl
        value={draft.challengerId}
        onChange={(challengerId) => setDraft({ ...draft, challengerId })}
      >
        <Label>{m.battle_challenger()}</Label>
        <SegmentedControlItems className="flex-wrap">
          {challengers.map((positioning) => (
            <SegmentedControlItem key={positioning.id} value={positioning.id}>
              {positioning.label}
              {positioning.archived && (
                <span className="font-normal"> · {m.battle_comes_back()}</span>
              )}
            </SegmentedControlItem>
          ))}
        </SegmentedControlItems>
      </SegmentedControl>
      {create}
    </>
  );
}

/** Step 3: the Target restriction, the threshold and the Horizon, fixed once open; and the recap. */
function RulesStep({
  stageName,
  champion,
  challenger,
  criterion,
  draft,
  setDraft,
}: {
  stageName: string;
  champion: string;
  challenger: string;
  criterion: string;
  draft: OpeningDraft;
  setDraft: (draft: OpeningDraft) => void;
}) {
  const targetId = useId();
  const thresholdId = useId();
  const selectClass =
    'h-8 w-full rounded-control border border-input bg-background px-2 text-base focus-ring max-md:h-11 md:text-sm';
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={targetId}>{m.battle_target()}</Label>
        <select
          id={targetId}
          value={draft.target}
          onChange={(event) => {
            const target = targetChoice.safeParse(event.target.value);
            if (target.success) setDraft({ ...draft, target: target.data });
          }}
          className={selectClass}
        >
          {targetChoice.options.map((target) => (
            <option key={target} value={target}>
              {TARGET_OPTION[target]()}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={thresholdId}>{m.battle_threshold()}</Label>
        <select
          id={thresholdId}
          value={draft.threshold}
          onChange={(event) => setDraft({ ...draft, threshold: Number(event.target.value) })}
          className={selectClass}
        >
          {BATTLE_THRESHOLDS.map((threshold) => (
            <option key={threshold} value={threshold}>
              {threshold === DEFAULT_BATTLE_THRESHOLD
                ? m.battle_threshold_default({ percent: percent(threshold) })
                : percent(threshold)}
            </option>
          ))}
        </select>
      </div>
      <NumberField
        value={draft.horizon}
        minValue={BATTLE_MINIMUM_FINISHED}
        maxValue={BATTLE_HORIZON_MAX}
        step={1}
        formatOptions={{ maximumFractionDigits: 0 }}
        onChange={(horizon) => {
          if (!Number.isNaN(horizon)) setDraft({ ...draft, horizon });
        }}
        className="flex flex-col gap-1.5"
      >
        <Label>{m.battle_horizon()}</Label>
        <Input className="w-24 max-md:h-11" />
        <p className="text-sm text-muted-foreground">{m.battle_horizon_hint()}</p>
      </NumberField>
      <p className="text-sm text-muted-foreground">
        {m.battle_fixed_note({
          finished: BATTLE_MINIMUM_FINISHED,
          successes: BATTLE_MINIMUM_SUCCESSES,
        })}
      </p>
      <p className="rounded-control bg-surface p-3">
        {m.battle_recap({
          challenger,
          champion,
          criterion,
          restriction: draft.target === ALL_TARGETS ? '' : TARGET_RECAP[draft.target](),
          stage: stageName,
          finished: BATTLE_MINIMUM_FINISHED,
          successes: BATTLE_MINIMUM_SUCCESSES,
          horizon: draft.horizon,
        })}
      </p>
    </>
  );
}

/**
 * The creation of a Challenger at the Stage, opened from the wizard, which it leads back to with the
 * new one chosen (spec UX §6.10).
 */
function CreateChallenger({
  summary,
  stage,
  onBack,
}: {
  summary: Summary;
  stage: Stage;
  onBack: () => void;
}) {
  const [draft, setDraft] = useOpeningDraft(summary, stage);
  return (
    <PositioningPanel
      kind="new"
      summary={summary}
      stageId={stage.id}
      source={undefined}
      onClose={onBack}
      onSaved={onBack}
      back={{
        createLabel: m.battle_create_and_back(),
        cancelLabel: m.send_cancel_and_back(),
        onCreated: (positioningId) => {
          setDraft({ ...draft, step: 1, challengerId: positioningId });
          onBack();
        },
        onCanceled: onBack,
      }}
    />
  );
}
