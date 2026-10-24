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
 * The conclusive Battles, beside the list of Today (spec UX §5.1): each with its Stage, its gauge and
 * sentence, “Close…” and “Later”, which hides it until the next day on every device.
 */
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
  const api = useApi();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState<string>();
  const [sending, setSending] = useState<string>();
  if (battles.length === 0) return null;

  const later = async (battleId: string) => {
    setSending(battleId);
    setFailed(undefined);
    try {
      const response = await api.today.battles[':id'].later.$post({ param: { id: battleId } });
      if (!response.ok) throw new Error('POST /api/today/battles/:id/later failed');
      await queryClient.invalidateQueries({ queryKey: DAILY_PICKS_KEY });
    } catch {
      setFailed(battleId);
    } finally {
      setSending(undefined);
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 rounded-card border p-3">
      <h2 id={headingId} className="font-semibold">
        {m.today_conclusive_battles()}
      </h2>
      <ul aria-labelledby={headingId} className="flex flex-col gap-3">
        {battles.map((battle) => {
          const stage = summary.stages.find(({ id }) => id === battle.stageId);
          const sides = sidesOf(summary, battle);
          const rule = winRuleOf(battle);
          return (
            <li key={battle.id} className="flex flex-col gap-1">
              <span className="font-medium">{stage?.name}</span>
              <WinRuleGauge rule={rule} threshold={battle.threshold} sides={sides} compact />
              <span className="text-xs text-muted-foreground">
                {winRuleSentence(rule, sides, battle.threshold)}
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                <CloseButton
                  className="h-7 px-2.5 text-[0.8rem]"
                  onPress={() => onClose(battle.id)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="max-md:min-h-11"
                  isDisabled={sending === battle.id}
                  onPress={() => void later(battle.id)}
                >
                  {m.today_later()}
                </Button>
              </div>
              <ErrorMessage>{failed === battle.id && m.today_later_error()}</ErrorMessage>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
