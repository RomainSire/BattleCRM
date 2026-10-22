import { finishedTrials } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { ChevronRight } from 'lucide-react';
import { useId, useRef } from 'react';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { formatLocalDay } from '../contacts/format.ts';
import { useLocale } from '../i18n.ts';
import { Screen } from '../screens/screen.tsx';
import { useApi } from '../session.ts';
import {
  championAt,
  openBattleAt,
  summaryQuery,
  trialCountsOf,
  winRuleOf,
  type Summary,
} from '../summary.ts';
import { BattlePanel, sidesOf } from './battle-panel.tsx';
import { Opponents } from './opponents.tsx';
import { OpenBattlePanels, type BattlePanel as Panel } from './open-battle-panel.tsx';
import { WinRuleGauge, winRuleSentence, winRuleStateLabel } from './win-rule.tsx';

/** The address of the screen: the Stage whose panel is open, and which one (ST-70). */
type BattlesSearch = { stage?: string; panel?: Panel };

/** The id of the link of a Stage, which the focus goes back to when its panel closes. */
const stageLinkId = (stageId: string) => `battle-stage-${stageId}`;

/**
 * Battles (spec UX §5.5): one row per Stage of the Funnel, where its open Battle stands, or its
 * Champion and “Open a Battle…”; the panel of a Stage anchored next to them follows its Battle. Read on
 * a phone too, where the panel takes the screen and the opening stays reachable, stacked (spec UX §3.2).
 */
export function BattlesScreen() {
  useLocale();
  const api = useApi();
  const navigate = useNavigate();
  const { data: summary, isError } = useQuery(summaryQuery(api));
  const search: BattlesSearch = useSearch({ from: '/app/battles' });
  // A Stage opened by the User moves the focus into its panel; an address alone does not.
  const focusPanel = useRef(false);
  const onPanelHeading = (heading: HTMLHeadingElement | null) => {
    if (!heading || !focusPanel.current) return;
    focusPanel.current = false;
    heading.focus();
  };

  if (summary === undefined) {
    return (
      <Screen title={m.battles()}>
        <ErrorMessage>{isError && m.contacts_load_error()}</ErrorMessage>
      </Screen>
    );
  }

  const stages = summary.stages.filter(({ archived }) => !archived);
  const named = stages.find(({ id }) => id === search.stage);
  const namedBattle = named && openBattleAt(summary, named.id);
  // An opening kept by the address for a Stage gone, or that has a Battle open since, shows nothing;
  // nor does the panel of a Stage without an open Battle.
  const opening = named && namedBattle === undefined ? named : undefined;
  const shown = search.panel === 'progress' && named && namedBattle ? named : undefined;
  const open = (stageId: string, panel: Panel) =>
    void navigate({ to: '/battles', search: { stage: stageId, panel } });
  const close = () => void navigate({ to: '/battles', search: {}, replace: true });
  const closeShown = () => {
    const closed = shown?.id;
    void navigate({ to: '/battles', search: {} }).then(() => {
      if (closed) document.getElementById(stageLinkId(closed))?.focus();
    });
  };

  return (
    <Screen title={m.battles()}>
      <div
        className={cn(
          'grid items-start gap-4',
          shown && 'md:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]',
        )}
      >
        <ul
          className={cn(
            '@container flex flex-col divide-y rounded-card border',
            shown && 'max-md:hidden',
          )}
        >
          {stages.map((stage) => (
            <StageRow
              key={stage.id}
              summary={summary}
              stage={stage}
              isShown={stage.id === shown?.id}
              onShow={() => {
                focusPanel.current = true;
              }}
              onOpen={() => open(stage.id, 'open')}
            />
          ))}
        </ul>
        {shown && namedBattle && (
          <div className="md:sticky md:top-4">
            <BattlePanel
              key={shown.id}
              summary={summary}
              stage={shown}
              battle={namedBattle}
              headingRef={onPanelHeading}
              onClose={closeShown}
            />
          </div>
        )}
      </div>
      {opening && search.panel && search.panel !== 'progress' && (
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

/**
 * A Stage (spec UX §5.5): its open Battle, Champion against Challenger, the sentence, the mini gauge,
 * the finished Trials and successes, its state; or its Champion and “Open a Battle…”.
 */
function StageRow({
  summary,
  stage,
  isShown,
  onShow,
  onOpen,
}: {
  summary: Summary;
  stage: Summary['stages'][number];
  isShown: boolean;
  onShow: () => void;
  onOpen: () => void;
}) {
  const locale = useLocale();
  const headingId = useId();
  const battle = openBattleAt(summary, stage.id);
  const champion = championAt(summary, stage.id);
  if (!battle) {
    return (
      <li
        aria-labelledby={headingId}
        className="flex flex-col gap-2 p-4 @2xl:grid @2xl:grid-cols-[10rem_minmax(0,1fr)_auto] @2xl:items-center @2xl:gap-4"
      >
        <h2 id={headingId} className="font-medium">
          {stage.name}
        </h2>
        <p className="text-muted-foreground">
          {champion
            ? m.battles_none_with_champion({ champion: champion.label })
            : m.battles_none_nor_champion()}
        </p>
        <div className="@2xl:text-right">
          <Button variant="outline" className="font-medium max-md:min-h-11" onPress={onOpen}>
            {m.battles_open()}
          </Button>
        </div>
      </li>
    );
  }
  const sides = sidesOf(summary, battle);
  const rule = winRuleOf(battle);
  const { champion: championTrials, challenger: challengerTrials } = trialCountsOf(battle);
  return (
    // The whole row opens the panel: the link of the Stage stretches over it (one tab stop), and the
    // chevron says there is more behind (spec UX §5.5, as the rows of Contacts).
    <li
      aria-labelledby={headingId}
      className={cn(
        'group relative flex flex-col gap-2 p-4 pr-10 hover:bg-surface/50 @2xl:grid @2xl:grid-cols-[10rem_minmax(0,1fr)_11rem] @2xl:items-center @2xl:gap-4',
        isShown && 'shadow-[inset_3px_0_0_var(--accent-text)]',
      )}
    >
      <h2 id={headingId} className="font-medium">
        {/* The Stage whose panel is open is the link to the current address: marked `aria-current="page"`. */}
        <Link
          id={stageLinkId(stage.id)}
          to="/battles"
          search={{ stage: stage.id, panel: 'progress' }}
          onClick={onShow}
          className="underline-offset-4 outline-none group-hover:underline after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent-text"
        >
          {stage.name}
        </Link>
      </h2>
      <ChevronRight
        aria-hidden
        className="absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground group-hover:text-foreground"
      />
      <div className="flex flex-col gap-1.5">
        <Opponents champion={sides.champion} challenger={sides.challenger} />
        <p>{winRuleSentence(rule, sides, battle.threshold)}</p>
        <p className="text-sm text-muted-foreground">
          {m.battles_criterion({ criterion: battle.successCriterion })} ·{' '}
          {m.battles_opened_on({ day: formatLocalDay(battle.openedOn, locale) })}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <WinRuleGauge rule={rule} threshold={battle.threshold} compact />
        <p className="text-sm text-muted-foreground tabular-nums">
          {m.battles_row_counts({
            champion: finishedTrials(championTrials),
            challenger: finishedTrials(challengerTrials),
            successes: championTrials.successes + challengerTrials.successes,
          })}
        </p>
        <p className="text-sm font-medium">{winRuleStateLabel(rule)}</p>
      </div>
    </li>
  );
}
