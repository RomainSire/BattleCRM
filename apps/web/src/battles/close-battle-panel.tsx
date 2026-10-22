import { TAKEAWAY_MAX_LENGTH, type Verdict } from '@battlecrm/contract';
import { judgeVerdict, proposedVerdict, type WinRule } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { cn } from 'cn';
import { useState } from 'react';
import { Form, Radio, RadioGroup, Text, TextField } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { Checkbox } from '../components/ui/checkbox.tsx';
import { ErrorMessage, FieldErrorMessage } from '../components/ui/error-message.tsx';
import {
  GesturePanel,
  GesturePanelBody,
  GesturePanelFooter,
} from '../components/ui/gesture-panel.tsx';
import { Label } from '../components/ui/label.tsx';
import { Textarea } from '../components/ui/textarea.tsx';
import { useSendGesture } from '../gesture.ts';
import { useApi } from '../session.ts';
import { trialCountsOf, winRuleOf, type Summary, type SummaryBattle } from '../summary.ts';
import { sidesOf } from './battle-panel.tsx';
import type { Sides } from './win-rule.tsx';

type Stage = Summary['stages'][number];

/** How each Verdict reads as a choice of the closing window. */
const OPTION: Record<Verdict, (sides: Sides) => string> = {
  challenger_wins: ({ challenger }) => m.battle_verdict_option_challenger_wins({ challenger }),
  title_defended: ({ champion }) => m.battle_verdict_option_title_defended({ champion }),
  draw: ({ champion }) => m.battle_verdict_option_draw({ champion }),
  not_enough_data: ({ champion }) => m.battle_verdict_option_not_enough_data({ champion }),
  abandoned: () => m.battle_verdict_option_abandoned(),
};

/**
 * The Verdicts offered (spec UX §6.9): the one the Win rule proposes first, then a winner to designate
 * either way, then abandoning. A draw or not enough data only as the rule finds them.
 */
function verdictsFor(rule: WinRule): Verdict[] {
  const proposed = proposedVerdict(rule);
  const others: Verdict[] = ['challenger_wins', 'title_defended', 'abandoned'];
  return proposed ? [proposed, ...others.filter((verdict) => verdict !== proposed)] : others;
}

/** What the closing does (spec UX §6.9, §10): the new Champion first, then the one archived. */
function consequencesOf(verdict: Verdict, sides: Sides, stage: string) {
  const { champion, challenger } = sides;
  if (verdict === 'challenger_wins') {
    return [
      m.battle_consequence_new_champion({ winner: challenger, stage }),
      m.battle_consequence_archived({ positioning: champion }),
    ];
  }
  if (verdict === 'title_defended') {
    return [m.battle_consequence_title_defended({ champion, challenger })];
  }
  if (verdict === 'abandoned') return [m.battle_consequence_abandoned({ champion, challenger })];
  return [
    verdict === 'draw'
      ? m.battle_consequence_draw({ champion, challenger })
      : m.battle_consequence_not_enough_data({ champion, challenger }),
    m.battle_consequence_archived({ positioning: challenger }),
  ];
}

/** Why a winner is designated (ADR 0001): the minimum not reached, the threshold not reached, or the other one. */
function unmetRule(rule: WinRule, verdict: Verdict, sides: Sides, threshold: number) {
  if (!rule.minimumReached) return m.battle_close_rule_unmet_minimum();
  if (rule.winner !== undefined) return m.battle_close_rule_unmet_against();
  const forChallenger = verdict === 'challenger_wins';
  const probability = forChallenger ? rule.probability : 1 - rule.probability;
  return m.battle_close_rule_unmet_threshold({
    // Rounded down, never to the threshold before it is reached (win-rule.tsx).
    percent: Math.floor(probability * 100),
    winner: forChallenger ? sides.challenger : sides.champion,
    threshold: Math.round(threshold * 100),
  });
}

/**
 * Closing a Battle (spec UX §6.9): the Verdict of the Win rule preselected; another winner once
 * “I designate this winner anyway” is checked after the warning; abandoning, which taught nothing;
 * what it does; an optional Takeaway, featured for a draw or not enough data. Confirmed, not undone
 * (spec UX §1): “Close” or “Later”.
 */
export function CloseBattlePanel({
  summary,
  stage,
  battle,
  onClose,
  onClosed,
}: {
  summary: Summary;
  stage: Stage;
  battle: SummaryBattle;
  onClose: () => void;
  onClosed: () => void;
}) {
  const api = useApi();
  const sendGesture = useSendGesture();
  const sides = sidesOf(summary, battle);
  const rule = winRuleOf(battle);
  const counts = trialCountsOf(battle);
  const [verdict, setVerdict] = useState<Verdict | undefined>(proposedVerdict(rule));
  const [designate, setDesignate] = useState(false);
  const [takeaway, setTakeaway] = useState('');
  const [wasSent, setWasSent] = useState(false);
  const [refusal, setRefusal] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const designated = verdict !== undefined && judgeVerdict(rule, verdict)?.designated === true;
  const inProgress = counts.champion.inProgress + counts.challenger.inProgress;
  const featured = verdict === 'draw' || verdict === 'not_enough_data';

  const close = async () => {
    if (verdict === undefined) return;
    setIsSending(true);
    setRefusal(undefined);
    const trimmed = takeaway.trim();
    const refused = await sendGesture(
      api.battles[':id'].close.$post({
        param: { id: battle.id },
        json: {
          verdict,
          ...(designated && { designate: true }),
          ...(trimmed !== '' && { takeaway: trimmed }),
        },
      }),
      () =>
        verdict === 'challenger_wins'
          ? m.battle_consequence_new_champion({ winner: sides.challenger, stage: stage.name })
          : m.battle_closed_title_kept({ stage: stage.name, champion: sides.champion }),
    ).finally(() => setIsSending(false));
    if (!refused) onClosed();
    else
      setRefusal(
        refused.error === 'battle_closed' ? m.battle_trial_closed() : m.battle_close_behind(),
      );
  };

  const takeawayField = (
    <TextField
      value={takeaway}
      onChange={setTakeaway}
      maxLength={TAKEAWAY_MAX_LENGTH}
      className={cn(
        'flex flex-col gap-1.5',
        featured && 'rounded-card border border-accent-text/50 bg-accent/10 p-3',
      )}
    >
      <Label>{m.battle_close_takeaway()}</Label>
      <Text slot="description" className="text-sm text-muted-foreground">
        {featured ? m.battle_close_takeaway_hint_featured() : m.battle_close_takeaway_hint()}
      </Text>
      <Textarea />
    </TextField>
  );

  return (
    <GesturePanel title={m.battle_close_title({ stage: stage.name })} onClose={onClose}>
      <Form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          setWasSent(true);
          if (verdict !== undefined && (!designated || designate)) void close();
        }}
      >
        <GesturePanelBody>
          <RadioGroup
            value={verdict ?? null}
            onChange={(value) => {
              setVerdict(verdictsFor(rule).find((option) => option === value));
              setDesignate(false);
            }}
            isInvalid={wasSent && verdict === undefined}
            className="flex flex-col gap-1.5"
          >
            <Label>{m.battle_close_verdict()}</Label>
            {verdictsFor(rule).map((option) => (
              <Radio
                key={option}
                value={option}
                className="group/radio flex cursor-default items-start gap-2 rounded-control p-1.5 focus-ring data-hovered:bg-surface max-md:min-h-11"
              >
                <span
                  aria-hidden
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input group-data-selected/radio:border-accent"
                >
                  <span className="hidden size-2 rounded-full bg-accent group-data-selected/radio:block" />
                </span>
                <span>
                  {OPTION[option](sides)}
                  {option === proposedVerdict(rule) && (
                    <span className="text-muted-foreground"> · {m.battle_verdict_proposed()}</span>
                  )}
                </span>
              </Radio>
            ))}
            <FieldErrorMessage>{m.battle_close_verdict_required()}</FieldErrorMessage>
          </RadioGroup>
          {designated && verdict && (
            <div className="flex flex-col gap-2 rounded-card border bg-surface p-3">
              <p>
                <strong>{unmetRule(rule, verdict, sides, battle.threshold)}</strong>{' '}
                {m.battle_close_designated_note()}
              </p>
              <Checkbox
                isSelected={designate}
                onChange={setDesignate}
                isInvalid={wasSent && !designate}
                className="max-md:min-h-11"
              >
                {m.battle_close_designate()}
              </Checkbox>
              {wasSent && !designate && (
                <ErrorMessage>{m.battle_close_designate_required()}</ErrorMessage>
              )}
            </div>
          )}
          {verdict === 'abandoned' && (
            <p className="rounded-card border bg-surface p-3">{m.battle_close_abandon_note()}</p>
          )}
          {featured && takeawayField}
          {verdict && (
            <section className="flex flex-col gap-1">
              <h3 className="font-medium">{m.battle_close_consequences()}</h3>
              <p>{consequencesOf(verdict, sides, stage.name).join(' ')}</p>
              {inProgress > 0 && (
                <p>{m.battle_consequence_trials_canceled({ count: inProgress })}</p>
              )}
            </section>
          )}
          {!featured && takeawayField}
          <ErrorMessage>{refusal}</ErrorMessage>
        </GesturePanelBody>
        <GesturePanelFooter>
          <Button variant="outline" className="max-md:min-h-11" onPress={onClose}>
            {m.battle_close_later()}
          </Button>
          <Button type="submit" isDisabled={isSending} className="max-md:min-h-11">
            {m.battle_close_confirm()}
          </Button>
        </GesturePanelFooter>
      </Form>
    </GesturePanel>
  );
}
