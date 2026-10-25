import { m } from '@battlecrm/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { CloseButton, sidesOf } from '../battles/battle-panel.tsx';
import { WinRuleGauge, winRuleSentence } from '../battles/win-rule.tsx';
import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { useApi } from '../session.ts';
import { battlesOf, winRuleOf, type Summary, type SummaryBattle } from '../summary.ts';
import { DAILY_PICKS_KEY } from './daily-picks.ts';

/** The open Battles the Win rule says are conclusive, but the ones put off today (spec UX §5.1). */
export const conclusiveBattlesOf = (summary: Summary, postponedBattleIds: readonly string[]) =>
  battlesOf(summary).filter(
    (battle) =>
      battle.open &&
      winRuleOf(battle).state === 'conclusive' &&
      !postponedBattleIds.includes(battle.id),
  );

/**
 * A conclusive Battle (spec UX §5.1): its Stage, its gauge and sentence, “Close…” and “Later”, which
 * hides it until the next day on every device.
 */
export function ConclusiveBattle({
  summary,
  battle,
  onClose,
}: {
  summary: Summary;
  battle: SummaryBattle;
  onClose: (battleId: string) => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const stage = summary.stages.find(({ id }) => id === battle.stageId);
  const sides = sidesOf(summary, battle);
  const rule = winRuleOf(battle);

  const later = async () => {
    setSending(true);
    setFailed(false);
    try {
      const response = await api.today.battles[':id'].later.$post({ param: { id: battle.id } });
      if (!response.ok) throw new Error('POST /api/today/battles/:id/later failed');
      await queryClient.invalidateQueries({ queryKey: DAILY_PICKS_KEY });
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium">{stage?.name}</span>
      <WinRuleGauge rule={rule} threshold={battle.threshold} sides={sides} compact />
      <span className="text-xs text-muted-foreground">
        {winRuleSentence(rule, sides, battle.threshold)}
      </span>
      <div className="flex flex-wrap gap-2 pt-1">
        <CloseButton className="h-7 px-2.5 text-[0.8rem]" onPress={() => onClose(battle.id)} />
        <Button
          variant="ghost"
          size="sm"
          className="max-md:min-h-11"
          isDisabled={sending}
          onPress={() => void later()}
        >
          {m.today_later()}
        </Button>
      </div>
      <ErrorMessage>{failed && m.today_later_error()}</ErrorMessage>
    </div>
  );
}

/** The conclusive Battles, beside the list of Today (spec UX §5.1). */
export function ConclusiveBattles({
  summary,
  battles,
  onClose,
}: {
  summary: Summary;
  battles: SummaryBattle[];
  onClose: (battleId: string) => void;
}) {
  const headingId = useId();
  if (battles.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 rounded-card border p-3">
      <h2 id={headingId} className="font-semibold">
        {m.today_conclusive_battles()}
      </h2>
      <ul aria-labelledby={headingId} className="flex flex-col gap-3">
        {battles.map((battle) => (
          <li key={battle.id}>
            <ConclusiveBattle summary={summary} battle={battle} onClose={onClose} />
          </li>
        ))}
      </ul>
    </section>
  );
}
