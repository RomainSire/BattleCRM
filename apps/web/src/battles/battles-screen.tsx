import { m } from '@battlecrm/i18n';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useId } from 'react';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { formatLocalDay } from '../contacts/format.ts';
import { useLocale } from '../i18n.ts';
import { Screen } from '../screens/screen.tsx';
import { useApi } from '../session.ts';
import {
  championAt,
  openBattleAt,
  positioningsOf,
  summaryQuery,
  type Summary,
} from '../summary.ts';
import { Opponents } from './opponents.tsx';
import { OpenBattlePanels, type BattlePanel } from './open-battle-panel.tsx';

/** The address of the screen: the Stage whose opening is under way, and its panel (ST-70). */
type BattlesSearch = { stage?: string; panel?: BattlePanel };

/**
 * Battles (spec UX §5.5): one row per Stage of the Funnel, its open Battle, or its Champion and
 * “Open a Battle…”. Read on a phone too, where the opening stays reachable, stacked (spec UX §3.2).
 */
export function BattlesScreen() {
  useLocale();
  const api = useApi();
  const navigate = useNavigate();
  const { data: summary, isError } = useQuery(summaryQuery(api));
  const search: BattlesSearch = useSearch({ from: '/app/battles' });

  if (summary === undefined) {
    return (
      <Screen title={m.battles()}>
        <ErrorMessage>{isError && m.contacts_load_error()}</ErrorMessage>
      </Screen>
    );
  }

  const stages = summary.stages.filter(({ archived }) => !archived);
  // An opening kept by the address for a Stage gone, or that has a Battle open since, shows nothing.
  const opening = stages.find(
    ({ id }) => id === search.stage && openBattleAt(summary, id) === undefined,
  );
  const open = (stageId: string, panel: BattlePanel) =>
    void navigate({ to: '/battles', search: { stage: stageId, panel } });
  const close = () => void navigate({ to: '/battles', search: {}, replace: true });

  return (
    <Screen title={m.battles()}>
      <ul className="flex flex-col divide-y rounded-card border">
        {stages.map((stage) => (
          <StageRow
            key={stage.id}
            summary={summary}
            stage={stage}
            onOpen={() => open(stage.id, 'open')}
          />
        ))}
      </ul>
      {opening && search.panel && (
        <OpenBattlePanels
          key={opening.id}
          summary={summary}
          stage={opening}
          panel={search.panel}
          onPanel={(panel) => open(opening.id, panel)}
          onClose={close}
        />
      )}
    </Screen>
  );
}

/** A Stage, its open Battle or its Champion (spec UX §5.5). */
function StageRow({
  summary,
  stage,
  onOpen,
}: {
  summary: Summary;
  stage: Summary['stages'][number];
  onOpen: () => void;
}) {
  const locale = useLocale();
  const headingId = useId();
  const battle = openBattleAt(summary, stage.id);
  const labelOf = (id: string) =>
    positioningsOf(summary).find((row) => row.id === id)?.label ?? '…';
  const champion = championAt(summary, stage.id);
  return (
    <li
      aria-labelledby={headingId}
      className="flex flex-col gap-2 p-4 md:grid md:grid-cols-[12rem_minmax(0,1fr)_auto] md:items-center md:gap-4"
    >
      <h2 id={headingId} className="font-medium">
        {stage.name}
      </h2>
      {battle ? (
        <div className="flex flex-col gap-1.5">
          <Opponents
            champion={labelOf(battle.championId)}
            challenger={labelOf(battle.challengerId)}
          />
          <p className="text-sm text-muted-foreground">
            {m.battles_criterion({ criterion: battle.successCriterion })} ·{' '}
            {m.battles_opened_on({ day: formatLocalDay(battle.openedOn, locale) })}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground">
          {champion
            ? m.battles_none_with_champion({ champion: champion.label })
            : m.battles_none_nor_champion()}
        </p>
      )}
      <div className="md:text-right">
        {!battle && (
          <Button variant="outline" className="font-medium max-md:min-h-11" onPress={onOpen}>
            {m.battles_open()}
          </Button>
        )}
      </div>
    </li>
  );
}
