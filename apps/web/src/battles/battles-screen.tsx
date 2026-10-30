import { finishedTrials } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { Button, ErrorMessage } from '@battlecrm/ui';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { ChevronRight } from 'lucide-react';
import { useId, useRef } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { formatLocalDay } from '../contacts/format.ts';
import { useLocale } from '../i18n.ts';
import { Screen } from '../screens/screen.tsx';
import { useApi } from '../session.ts';
import {
  battlesOf,
  championAt,
  openBattleAt,
  summaryQuery,
  trialCountsOf,
  winRuleOf,
  type Summary,
} from '../summary.ts';
import { BattlePanel, CloseButton, sidesOf, StagePanel, tabClass } from './battle-panel.tsx';
import { ChampionHistory, HistoryLegend } from './champion-history.tsx';
import { CloseBattlePanel } from './close-battle-panel.tsx';
import { Opponents } from './opponents.tsx';
import { OpenBattlePanels, type BattlePanel as Panel } from './open-battle-panel.tsx';
import { WinRuleGauge, winRuleSentence, winRuleStateLabel } from './win-rule.tsx';

/** The address of the screen: the view, the Stage whose panel is open, and which one (ST-70). */
type BattlesSearch = { view?: 'history'; stage?: string; panel?: Panel };

/** Whether a Battle waits for its closing (spec UX §5.5): conclusive, or at the Horizon. */
const awaitsClosing = (rule: ReturnType<typeof winRuleOf>) =>
  rule.state === 'conclusive' || rule.horizonReached;

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
  // nor does a closing of a Stage without an open Battle.
  const opening =
    named &&
    namedBattle === undefined &&
    (search.panel === 'open' || search.panel === 'new-positioning')
      ? { stage: named, panel: search.panel }
      : undefined;
  const shown = search.panel === 'progress' || search.panel === 'close' ? named : undefined;
  const closing = search.panel === 'close' ? namedBattle : undefined;
  const open = (stageId: string, panel: Panel) =>
    void navigate({ to: '/battles', search: { stage: stageId, panel } });
  const close = () => void navigate({ to: '/battles', search: {}, replace: true });
  const closeShown = () => {
    const closed = shown?.id;
    void navigate({ to: '/battles', search: {} }).then(() => {
      if (closed) document.getElementById(stageLinkId(closed))?.focus();
    });
  };
  const backToPanel = (stageId: string) =>
    void navigate({ to: '/battles', search: { stage: stageId, panel: 'progress' }, replace: true });

  return (
    <Screen title={m.battles()}>
      <Tabs
        selectedKey={search.view ?? 'battles'}
        onSelectionChange={(key) =>
          void navigate({ to: '/battles', search: key === 'history' ? { view: 'history' } : {} })
        }
      >
        <TabList aria-label={m.battles()} className="mb-4 flex flex-wrap gap-1 border-b pb-2">
          <Tab id="battles" className={tabClass}>
            {m.battles_view_battles()}
          </Tab>
          <Tab id="history" className={tabClass}>
            {m.battles_view_history()}
          </Tab>
        </TabList>
        <TabPanel id="battles" className="rounded-control focus-ring">
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
                  onClose={() => open(stage.id, 'close')}
                />
              ))}
            </ul>
            {shown && (
              <div className="md:sticky md:top-4">
                {namedBattle ? (
                  <BattlePanel
                    key={namedBattle.id}
                    summary={summary}
                    stage={shown}
                    battle={namedBattle}
                    headingRef={onPanelHeading}
                    onClose={closeShown}
                    onCloseBattle={() => open(shown.id, 'close')}
                  />
                ) : (
                  <StagePanel
                    key={shown.id}
                    summary={summary}
                    stage={shown}
                    headingRef={onPanelHeading}
                    onClose={closeShown}
                    onOpen={() => open(shown.id, 'open')}
                  />
                )}
              </div>
            )}
          </div>
        </TabPanel>
        <TabPanel id="history" className="flex flex-col gap-4 rounded-control focus-ring">
          <HistoryView summary={summary} />
        </TabPanel>
      </Tabs>
      {opening && (
        <OpenBattlePanels
          key={opening.stage.id}
          summary={summary}
          stage={opening.stage}
          panel={opening.panel}
          onPanel={(panel) => open(opening.stage.id, panel)}
          onClose={close}
        />
      )}
      {shown && closing && (
        <CloseBattlePanel
          key={closing.id}
          summary={summary}
          stage={shown}
          battle={closing}
          onClose={() => backToPanel(shown.id)}
          onClosed={() => backToPanel(shown.id)}
        />
      )}
    </Screen>
  );
}

/**
 * The Champion history (spec UX §5.5): one lineage per Stage that had a Battle, archived Stages
 * included, in the order of the Funnel, with its legend.
 */
function HistoryView({ summary }: { summary: Summary }) {
  const battles = battlesOf(summary);
  const stages = summary.stages.filter(({ id }) => battles.some(({ stageId }) => stageId === id));
  if (stages.length === 0)
    return <p className="text-muted-foreground">{m.history_none_at_all()}</p>;
  return (
    <>
      <HistoryLegend />
      {stages.map((stage) => (
        <section key={stage.id} className="flex flex-col gap-2 rounded-card border p-4">
          <h2 className="font-medium">
            {stage.archived ? m.history_stage_archived({ stage: stage.name }) : stage.name}
          </h2>
          <ChampionHistory summary={summary} stageId={stage.id} />
        </section>
      ))}
    </>
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
  onClose,
}: {
  summary: Summary;
  stage: Summary['stages'][number];
  isShown: boolean;
  onShow: () => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  const locale = useLocale();
  const headingId = useId();
  const battle = openBattleAt(summary, stage.id);
  const champion = championAt(summary, stage.id);
  const stageLink = (
    // The whole row opens the panel: the link of the Stage stretches over it (one tab stop), and the
    // chevron says there is more behind (spec UX §5.5, as the rows of Contacts). The Stage whose
    // panel is open is the link to the current address: marked `aria-current="page"`.
    <h2 id={headingId} className="font-medium">
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
  );
  const chevron = (
    <ChevronRight
      aria-hidden
      className="absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground group-hover:text-foreground"
    />
  );
  const rowClass = cn(
    'group relative flex flex-col gap-2 p-4 pr-10 hover:bg-surface/50 @2xl:grid @2xl:items-center @2xl:gap-4',
    isShown && 'shadow-[inset_3px_0_0_var(--accent-text)]',
  );
  if (!battle) {
    return (
      <li
        aria-labelledby={headingId}
        className={cn(rowClass, '@2xl:grid-cols-[10rem_minmax(0,1fr)_auto]')}
      >
        {stageLink}
        {chevron}
        <p className="text-muted-foreground">
          {champion
            ? m.battles_none_with_champion({ champion: champion.label })
            : m.battles_none_nor_champion()}
        </p>
        <div className="@2xl:text-right">
          {/* Above the link stretched over the row. */}
          <Button
            variant="outline"
            className="relative z-10 font-medium max-md:min-h-11"
            onPress={onOpen}
          >
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
    <li
      aria-labelledby={headingId}
      className={cn(rowClass, '@2xl:grid-cols-[10rem_minmax(0,1fr)_11rem]')}
    >
      {stageLink}
      {chevron}
      <div className="flex flex-col gap-1.5">
        <Opponents champion={sides.champion} challenger={sides.challenger} />
        <p>{winRuleSentence(rule, sides, battle.threshold)}</p>
        <p className="text-sm text-muted-foreground">
          {m.battles_criterion({ criterion: battle.successCriterion })} ·{' '}
          {m.battles_opened_on({ day: formatLocalDay(battle.openedOn, locale) })}
        </p>
      </div>
      <div className="flex flex-col items-start gap-1">
        <WinRuleGauge rule={rule} threshold={battle.threshold} compact />
        <p className="text-sm text-muted-foreground tabular-nums">
          {m.battles_row_counts({
            champion: finishedTrials(championTrials),
            challenger: finishedTrials(challengerTrials),
            successes: championTrials.successes + challengerTrials.successes,
          })}
        </p>
        {awaitsClosing(rule) ? (
          // Out of the routine, outlined with the accent (spec UX §2); above the stretched link.
          <CloseButton onPress={onClose} className="relative z-10" />
        ) : (
          <p className="text-sm font-medium">{winRuleStateLabel(rule)}</p>
        )}
      </div>
    </li>
  );
}
