import type { WinRule } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { getLocale } from '@battlecrm/i18n/runtime';
import { cn } from 'cn';

/** The two sides of a Battle, by their labels. */
export type Sides = { champion: string; challenger: string };

/** Below this distance from one half, no Positioning is said to lead (spec UX §5.5, “too early”). */
const CLEAR_TREND = 0.1;

/** A probability as a whole percentage, never rounded up to the threshold it has not reached. */
const percentOf = (probability: number) => Math.floor(probability * 100);

/** What the minimum still lacks, as a list: finished Trials of each side, then successes. */
function missingText(rule: WinRule, { champion, challenger }: Sides) {
  const parts: string[] = [];
  const finished = [
    { count: rule.missing.champion, positioning: champion },
    { count: rule.missing.challenger, positioning: challenger },
  ].filter(({ count }) => count > 0);
  finished.forEach((part, index) =>
    parts.push(
      index === 0 ? m.win_rule_missing_finished(part) : m.win_rule_missing_finished_short(part),
    ),
  );
  if (rule.missing.successes > 0) {
    parts.push(m.win_rule_missing_successes({ count: rule.missing.successes }));
  }
  return new Intl.ListFormat(getLocale(), { type: 'conjunction' }).format(parts);
}

/**
 * The sentence of a Battle (spec UX §5.5): the text equivalent of its gauge, which is decorative.
 * Too early (who leads, what is missing), how likely the leader is better, conclusive, or the Horizon.
 */
export function winRuleSentence(rule: WinRule, sides: Sides, threshold: number): string {
  const { champion, challenger } = sides;
  const challengerLeads = rule.probability >= 0.5;
  const leader = challengerLeads ? challenger : champion;
  const other = challengerLeads ? champion : challenger;
  const leaderProbability = challengerLeads ? rule.probability : 1 - rule.probability;
  switch (rule.state) {
    case 'conclusive':
      return m.win_rule_conclusive({
        winner: rule.winner === 'challenger' ? challenger : champion,
        loser: rule.winner === 'challenger' ? champion : challenger,
        percent: percentOf(rule.winner === 'challenger' ? rule.probability : 1 - rule.probability),
      });
    case 'draw':
      return m.win_rule_draw({ champion });
    case 'not_enough_data':
      return m.win_rule_not_enough_data({ champion });
    case 'in_progress':
      return m.win_rule_in_progress({
        leader,
        other,
        percent: percentOf(leaderProbability),
        threshold: Math.round(threshold * 100),
      });
  }
  return m.win_rule_too_early({
    trend:
      Math.abs(rule.probability - 0.5) > CLEAR_TREND
        ? m.win_rule_leads({ positioning: leader })
        : m.win_rule_no_trend(),
    missing: missingText(rule, sides),
  });
}

/** The state of a Battle in a word (spec UX §5.5): too early, in progress, conclusive, Horizon reached. */
export function winRuleStateLabel(rule: WinRule): string {
  if (rule.state === 'conclusive') return m.battle_state_conclusive();
  if (rule.state === 'draw' || rule.state === 'not_enough_data') return m.battle_state_horizon();
  return rule.state === 'in_progress' ? m.battle_state_in_progress() : m.battle_state_too_early();
}

/** Hatched, while the minimum is not reached: shown, but only indicative (spec UX §5.5). */
const HATCHED =
  'bg-[repeating-linear-gradient(45deg,var(--surface),var(--surface)_6px,var(--border)_6px,var(--border)_12px)]';

/**
 * The gauge of a Battle (spec UX §5.5): P(Challenger better), the zone of the Champion's threshold on
 * the left, the Challenger's on the right. Decorative: its sentence says it all. Greyed and hatched,
 * marked indicative, while the minimum is not reached. `compact` for the row of the Battles screen.
 */
export function WinRuleGauge({
  rule,
  threshold,
  sides,
  compact = false,
}: {
  rule: WinRule;
  threshold: number;
  sides?: Sides;
  compact?: boolean;
}) {
  const zone = `${Math.round((1 - threshold) * 100)}%`;
  const position = `${rule.probability * 100}%`;
  return (
    <div className={cn('flex flex-col gap-1', !compact && 'py-1')}>
      {sides && (
        <div aria-hidden className="flex justify-between gap-2 text-xs font-semibold">
          <span className="truncate text-neutral-text">{sides.champion}</span>
          <span className="truncate text-accent-text">{sides.challenger}</span>
        </div>
      )}
      <div
        aria-hidden
        className={cn(
          'relative rounded-full border border-input',
          compact ? 'h-2.5' : 'h-5',
          rule.minimumReached ? 'bg-surface' : HATCHED,
        )}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-neutral-dot/40"
          style={{ width: zone }}
        />
        <div
          className={cn(
            'absolute inset-y-0 right-0 rounded-r-full',
            rule.minimumReached ? 'bg-accent/30' : 'bg-neutral-dot/40',
          )}
          style={{ width: zone }}
        />
        <div
          className={cn(
            'absolute -translate-x-1/2 rounded-full',
            compact ? '-inset-y-1 w-1' : '-inset-y-1.5 w-1.5',
            rule.minimumReached ? 'bg-foreground' : 'bg-neutral-text',
          )}
          style={{ left: position }}
        />
      </div>
      {!compact && (
        <div aria-hidden className="flex justify-between text-xs text-muted-foreground">
          <span>{m.battle_percent({ percent: Math.round(threshold * 100) })}</span>
          <span>{m.battle_percent({ percent: Math.round(threshold * 100) })}</span>
        </div>
      )}
      {!rule.minimumReached && !compact && (
        <p className="text-center text-xs text-muted-foreground">{m.battle_indicative()}</p>
      )}
    </div>
  );
}
