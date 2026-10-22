import {
  BATTLE_MINIMUM_FINISHED,
  BATTLE_MINIMUM_SUCCESSES,
  CANCEL_REASON_MAX_LENGTH,
  TARGETS,
  TRIAL_OUTCOMES,
  type BattleTarget,
  type BattleTrial,
  type TrialOutcome,
} from '@battlecrm/contract';
import { finishedTrials, startedTrials, type TrialCounts } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useId, useState, type Ref } from 'react';
import { Form, Tab, TabList, TabPanel, Tabs, TextField } from 'react-aria-components';

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
import { formatLocalDay } from '../contacts/format.ts';
import { useSendGesture, type RefusalOf } from '../gesture.ts';
import { useLocale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';
import {
  battleTrialsKey,
  positioningsOf,
  trialCountsOf,
  winRuleOf,
  type Summary,
  type SummaryBattle,
} from '../summary.ts';
import { TARGET_OPTION } from './open-battle-panel.tsx';
import { Opponents } from './opponents.tsx';
import { WinRuleGauge, winRuleSentence, winRuleStateLabel, type Sides } from './win-rule.tsx';

type Stage = Summary['stages'][number];

/** The Trials of a Battle, read on demand when its panel shows them (spec stack §3). */
const battleTrialsQuery = (api: ApiClient, battleId: string) =>
  queryOptions({
    queryKey: battleTrialsKey(battleId),
    queryFn: async (): Promise<BattleTrial[]> => {
      const response = await api.battles[':id'].trials.$get({ param: { id: battleId } });
      if (!response.ok) throw new Error('GET /api/battles/:id/trials failed');
      return (await response.json()).trials;
    },
    retry: false,
  });

const tabClass =
  'cursor-default rounded-control px-2 py-1 text-muted-foreground focus-ring data-hovered:text-foreground data-selected:bg-surface data-selected:font-medium data-selected:text-foreground max-md:min-h-11';

/** The labels of the two sides of a Battle. */
export function sidesOf(summary: Summary, battle: SummaryBattle): Sides {
  const labelOf = (id: string) =>
    positioningsOf(summary).find((row) => row.id === id)?.label ?? '…';
  return { champion: labelOf(battle.championId), challenger: labelOf(battle.challengerId) };
}

/**
 * The panel of a Stage with an open Battle (spec UX §5.5), anchored next to the Battles: Progress,
 * Trials (their outcome changed in place while it is open) and By Target. No modal, a region of the
 * layout; `Escape` closes it. The Champion history of the Stage comes with closing (ticket 32).
 */
export function BattlePanel({
  summary,
  stage,
  battle,
  headingRef,
  onClose,
}: {
  summary: Summary;
  stage: Stage;
  battle: SummaryBattle;
  headingRef?: Ref<HTMLHeadingElement>;
  onClose: () => void;
}) {
  useLocale();
  const headingId = useId();
  const sides = sidesOf(summary, battle);
  const rule = winRuleOf(battle);
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape from any control inside the panel, while the focus is there.
    <section
      aria-labelledby={headingId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      className="flex flex-col gap-3 rounded-card border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="rounded-control text-base font-medium focus-ring"
        >
          {stage.name}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={m.close()}
          className="max-md:size-11"
          onPress={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Opponents champion={sides.champion} challenger={sides.challenger} />
        <span className="text-sm text-muted-foreground">{winRuleStateLabel(rule)}</span>
      </div>
      <Tabs>
        <TabList aria-label={stage.name} className="flex flex-wrap gap-1 border-b pb-2">
          <Tab id="progress" className={tabClass}>
            {m.battle_tab_follow()}
          </Tab>
          <Tab id="trials" className={tabClass}>
            {m.battle_tab_trials()}
          </Tab>
          <Tab id="by-target" className={tabClass}>
            {m.battle_tab_by_target()}
          </Tab>
        </TabList>
        <TabPanel id="progress" className="flex flex-col gap-3 rounded-control pt-3 focus-ring">
          <ProgressTab battle={battle} sides={sides} />
        </TabPanel>
        <TabPanel id="trials" className="flex flex-col gap-3 rounded-control pt-3 focus-ring">
          <TrialsTab summary={summary} battle={battle} sides={sides} />
        </TabPanel>
        <TabPanel id="by-target" className="flex flex-col gap-3 rounded-control pt-3 focus-ring">
          <ByTargetTab battle={battle} sides={sides} />
        </TabPanel>
      </Tabs>
    </section>
  );
}

/**
 * Progress (spec UX §5.5): the sentence, the banner once conclusive or at the Horizon, the gauge,
 * the progress to the minimum and the Horizon, and what the Battle was opened with.
 */
function ProgressTab({ battle, sides }: { battle: SummaryBattle; sides: Sides }) {
  const locale = useLocale();
  const rule = winRuleOf(battle);
  const counts = trialCountsOf(battle);
  const progress = (positioning: string, side: TrialCounts) =>
    m.battle_progress_side({
      positioning,
      finished: finishedTrials(side),
      minimum: BATTLE_MINIMUM_FINISHED,
      started: startedTrials(side),
      horizon: battle.horizon,
    });
  const winner = rule.winner === 'challenger' ? sides.challenger : sides.champion;
  return (
    <>
      <p className="text-base leading-snug">{winRuleSentence(rule, sides, battle.threshold)}</p>
      {rule.state === 'conclusive' && (
        <p className="rounded-card border border-accent-text/50 bg-accent/10 p-3">
          <strong>{m.battle_banner_conclusive_title()}</strong>{' '}
          {m.battle_banner_conclusive({ winner })}
        </p>
      )}
      {rule.state !== 'conclusive' && rule.horizonReached && (
        <p className="rounded-card border bg-surface p-3">
          <strong>{m.battle_banner_horizon_title()}</strong> {m.battle_banner_horizon()}
        </p>
      )}
      <WinRuleGauge rule={rule} threshold={battle.threshold} sides={sides} />
      <ul className="flex flex-col gap-1 text-sm">
        <li>{progress(sides.champion, counts.champion)}</li>
        <li>{progress(sides.challenger, counts.challenger)}</li>
        <li>
          {m.battle_progress_successes({
            successes: counts.champion.successes + counts.challenger.successes,
            minimum: BATTLE_MINIMUM_SUCCESSES,
          })}
        </li>
      </ul>
      <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
        <li>{m.battle_meta_criterion({ criterion: battle.successCriterion })}</li>
        <li>
          {m.battle_meta_target({
            target:
              battle.target === null ? m.battle_meta_all_targets() : TARGET_OPTION[battle.target](),
          })}
        </li>
        <li>{m.battle_meta_threshold({ percent: Math.round(battle.threshold * 100) })}</li>
        <li>{m.battle_meta_horizon({ horizon: battle.horizon })}</li>
        <li>{m.battles_opened_on({ day: formatLocalDay(battle.openedOn, locale) })}</li>
      </ul>
    </>
  );
}

/** What each outcome reads as, in the table and its menu. */
const OUTCOME_LABEL: Record<TrialOutcome, () => string> = {
  in_progress: m.battle_outcome_in_progress,
  success: m.trial_outcome_success,
  no_result: m.trial_outcome_no_result,
  canceled: m.trial_outcome_canceled,
};

type ChangeRefusal = RefusalOf<ApiClient['trials'][':id']['change-outcome']['$post']>;

/** What a refusal tells the User: the Battle closed, the Contact busy or gone, or this device behind. */
function refusalText(refused: ChangeRefusal) {
  if (refused.error === 'battle_closed') return m.battle_trial_closed();
  if (refused.error === 'trial_in_progress') return m.battle_trial_elsewhere();
  if (refused.error === 'not_prospecting') return m.battle_trial_not_prospecting();
  if (refused.error === 'already_tried') return m.battle_trial_already_tried();
  return m.battle_trial_behind();
}

/**
 * Trials (spec UX §5.5): Contact, Positioning, day and outcome, changed in place while the Battle is
 * open, with its Success criterion recalled; canceling asks for the reason.
 */
function TrialsTab({
  summary,
  battle,
  sides,
}: {
  summary: Summary;
  battle: SummaryBattle;
  sides: Sides;
}) {
  const locale = useLocale();
  const api = useApi();
  const sendGesture = useSendGesture();
  const { data: trials, isError } = useQuery(battleTrialsQuery(api, battle.id));
  const [refusal, setRefusal] = useState<string>();
  const [canceling, setCanceling] = useState<BattleTrial>();
  const nameOf = (contactId: string) =>
    summary.contacts.find(({ id }) => id === contactId)?.name ?? '…';
  const sideOf = (positioningId: string) =>
    positioningId === battle.championId ? sides.champion : sides.challenger;

  const change = async (row: BattleTrial, outcome: TrialOutcome, cancelReason?: string) => {
    setRefusal(undefined);
    const refused = await sendGesture(
      api.trials[':id']['change-outcome'].$post({
        param: { id: row.id },
        json: cancelReason === undefined ? { outcome } : { outcome, cancelReason },
      }),
      () =>
        m.battle_outcome_changed_toast({
          contact: nameOf(row.contactId),
          outcome: OUTCOME_LABEL[outcome](),
        }),
    );
    if (refused) setRefusal(refusalText(refused));
    return refused;
  };

  if (trials === undefined) {
    return <ErrorMessage>{isError && m.battle_trials_load_error()}</ErrorMessage>;
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {m.battle_meta_criterion({ criterion: battle.successCriterion })}
        {battle.open && <> · {m.battle_trials_editable()}</>}
      </p>
      <ErrorMessage>{refusal}</ErrorMessage>
      {trials.length === 0 ? (
        <p className="text-muted-foreground">{m.battle_trials_empty()}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-2 font-medium">{m.battle_trials_contact()}</th>
                <th className="py-1.5 pr-2 font-medium">{m.battle_trials_positioning()}</th>
                <th className="py-1.5 pr-2 font-medium">{m.battle_trials_started()}</th>
                <th className="py-1.5 font-medium">{m.battle_trials_outcome()}</th>
              </tr>
            </thead>
            <tbody className="divide-y border-t">
              {trials.map((row) => {
                const name = nameOf(row.contactId);
                const outcome = OUTCOME_LABEL[row.outcome]();
                return (
                  <tr
                    key={row.id}
                    className={row.outcome === 'canceled' ? 'text-muted-foreground' : ''}
                  >
                    <td className="py-1.5 pr-2">{name}</td>
                    <td className="py-1.5 pr-2">{sideOf(row.positioningId)}</td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      {formatLocalDay(row.startedOn, locale)}
                    </td>
                    <td className="py-1.5">
                      {battle.open ? (
                        <MoreActions
                          trigger={{
                            text: outcome,
                            label: m.battle_trial_outcome_label({ contact: name, outcome }),
                          }}
                          onAction={(key) => {
                            if (key === 'canceled') setCanceling(row);
                            else {
                              const chosen = TRIAL_OUTCOMES.find((value) => value === key);
                              if (chosen) void change(row, chosen);
                            }
                          }}
                        >
                          {TRIAL_OUTCOMES.filter((value) => value !== row.outcome).map((value) => (
                            <MenuItem key={value} id={value}>
                              {value === 'canceled'
                                ? m.battle_outcome_cancel()
                                : OUTCOME_LABEL[value]()}
                            </MenuItem>
                          ))}
                        </MoreActions>
                      ) : (
                        outcome
                      )}
                      {row.cancelReason !== null && (
                        <p className="text-xs text-muted-foreground">{row.cancelReason}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {canceling && (
        <CancelTrialPanel
          contact={nameOf(canceling.contactId)}
          error={refusal}
          onCancel={async (reason) => {
            // Refused, the panel stays open with what was typed, and says why.
            if (!(await change(canceling, 'canceled', reason))) setCanceling(undefined);
          }}
          onClose={() => {
            setRefusal(undefined);
            setCanceling(undefined);
          }}
        />
      )}
    </>
  );
}

/** Canceling a Trial from its Battle (CONTEXT.md, Trial): with its reason, required. */
function CancelTrialPanel({
  contact,
  error,
  onCancel,
  onClose,
}: {
  contact: string;
  error: string | undefined;
  onCancel: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [wasSent, setWasSent] = useState(false);
  const isMissing = reason.trim() === '';
  return (
    <GesturePanel title={m.battle_cancel_trial_title({ contact })} onClose={onClose}>
      <Form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          setWasSent(true);
          if (!isMissing) void onCancel(reason.trim());
        }}
      >
        <GesturePanelBody>
          <p className="text-muted-foreground">{m.battle_cancel_trial_note()}</p>
          <TextField
            value={reason}
            onChange={setReason}
            maxLength={CANCEL_REASON_MAX_LENGTH}
            isInvalid={wasSent && isMissing}
            className="flex flex-col gap-1.5"
          >
            <Label>{m.trial_cancel_reason()}</Label>
            {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- the panel was just opened: its only field takes the focus, which closing gives back. */}
            <Input autoFocus className="max-md:h-11" />
            <FieldErrorMessage>{m.trial_cancel_reason_required()}</FieldErrorMessage>
          </TextField>
          <ErrorMessage>{error}</ErrorMessage>
        </GesturePanelBody>
        <GesturePanelFooter>
          <Button variant="outline" className="max-md:min-h-11" onPress={onClose}>
            {m.close()}
          </Button>
          <Button type="submit" className="max-md:min-h-11">
            {m.battle_cancel_trial()}
          </Button>
        </GesturePanelFooter>
      </Form>
    </GesturePanel>
  );
}

const TARGET_ROW: Record<BattleTarget, () => string> = {
  consultancy: m.battle_by_target_consultancy,
  end_client: m.battle_by_target_end_client,
  unknown: m.battle_by_target_unknown,
};

/**
 * By Target (spec UX §5.5): successes on finished Trials, per Target and Positioning, for information
 * only: the Verdict covers them all.
 */
function ByTargetTab({ battle, sides }: { battle: SummaryBattle; sides: Sides }) {
  const api = useApi();
  const { data: trials, isError } = useQuery(battleTrialsQuery(api, battle.id));
  if (trials === undefined) {
    return <ErrorMessage>{isError && m.battle_trials_load_error()}</ErrorMessage>;
  }
  const targets = battle.target === null ? TARGETS : [battle.target];
  const cell = (target: BattleTarget, positioningId: string) => {
    const finished = trials.filter(
      (row) =>
        row.target === target &&
        row.positioningId === positioningId &&
        (row.outcome === 'success' || row.outcome === 'no_result'),
    );
    if (finished.length === 0) return '—';
    return m.battle_by_target_cell({
      successes: finished.filter(({ outcome }) => outcome === 'success').length,
      finished: finished.length,
    });
  };
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1.5 pr-2 font-medium">{m.battle_by_target_target()}</th>
              <th className="py-1.5 pr-2 font-medium">{sides.champion}</th>
              <th className="py-1.5 font-medium">{sides.challenger}</th>
            </tr>
          </thead>
          <tbody className="divide-y border-t">
            {targets.map((target) => (
              <tr key={target}>
                <th scope="row" className="py-1.5 pr-2 font-normal">
                  {TARGET_ROW[target]()}
                </th>
                <td className="py-1.5 pr-2">{cell(target, battle.championId)}</td>
                <td className="py-1.5">{cell(target, battle.challengerId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">{m.battle_by_target_note()}</p>
    </>
  );
}
