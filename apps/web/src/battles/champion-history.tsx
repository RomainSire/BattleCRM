import { TAKEAWAY_MAX_LENGTH } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import { Button, ErrorMessage, Label, Textarea } from '@battlecrm/ui';
import { cn } from 'cn';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Form, TextField } from 'react-aria-components';

import {
  GesturePanel,
  GesturePanelBody,
  GesturePanelFooter,
} from '../components/ui/gesture-panel.tsx';
import { formatLocalDay } from '../contacts/format.ts';
import { useSendGesture } from '../gesture.ts';
import { useLocale } from '../i18n.ts';
import { useApi } from '../session.ts';
import {
  battlesOf,
  positioningsOf,
  titleHolderOf,
  verdictOf,
  type Summary,
  type SummaryBattle,
} from '../summary.ts';
import { VERDICT_LABEL } from './verdict.ts';

/** How a Champion holds its title in the history (spec UX §5.5): proven, designated, or kept. */
type Hold = 'proven' | 'designated' | 'kept';

const HOLD_CLASS: Record<Hold, string> = {
  // Teal, the colour of the Battle: green is the Success of a Trial (spec UX §11).
  proven: 'border-2 border-accent bg-accent/15',
  designated:
    'border-2 border-dashed border-muted-foreground bg-[repeating-linear-gradient(135deg,var(--surface)_0_6px,transparent_6px_12px)]',
  kept: 'border bg-background',
};

const HOLD_LABEL: Record<Hold, () => string> = {
  proven: m.history_proven,
  designated: m.history_designated,
  kept: m.history_title_kept,
};

/** One step of the history: a Champion holding its title, or the Verdict that led to it. */
type Step =
  | {
      kind: 'champion';
      championId: string;
      hold: Hold | 'initial';
      on: string;
      battle?: SummaryBattle;
    }
  | { kind: 'verdict'; battle: SummaryBattle }
  | { kind: 'under_way'; battle: SummaryBattle };

/**
 * The lineage of a Stage (CONTEXT.md, Champion history): the initial Champion, then for each closed
 * Battle its Verdict and the Champion after it, up to the Battle under way.
 */
function stepsOf(summary: Summary, stageId: string): Step[] {
  const battles = battlesOf(summary).filter((battle) => battle.stageId === stageId);
  const [first] = battles;
  if (!first) return [];
  const steps: Step[] = [
    { kind: 'champion', championId: first.championId, hold: 'initial', on: first.openedOn },
  ];
  for (const battle of battles) {
    const verdict = verdictOf(battle);
    if (battle.open || verdict === null) {
      steps.push({ kind: 'under_way', battle });
      continue;
    }
    // A winner, Challenger or Champion, is proven or designated; a draw, not enough data or an
    // abandoned Battle only keep the title (spec UX §5.5).
    let hold: Hold = 'kept';
    if (verdict === 'challenger_wins' || verdict === 'title_defended') {
      hold = battle.designated ? 'designated' : 'proven';
    }
    steps.push(
      { kind: 'verdict', battle },
      {
        kind: 'champion',
        championId: titleHolderOf(battle),
        hold,
        on: battle.closedOn ?? battle.openedOn,
        battle,
      },
    );
  }
  return steps;
}

/** What the lineages read as (spec UX §5.5): the three holds, written out. */
export const HistoryLegend = () => (
  <p className="text-sm text-muted-foreground">{m.history_legend()}</p>
);

/**
 * The Champion history of a Stage (spec UX §5.5): a horizontal lineage, from the initial Champion to
 * the Battle under way; each Champion with its date and the Takeaway of the Battle it came from, the
 * Verdict on each arrow. Proven, designated or kept is written out, never told by the colour alone.
 */
export function ChampionHistory({ summary, stageId }: { summary: Summary; stageId: string }) {
  const locale = useLocale();
  const [editing, setEditing] = useState<SummaryBattle>();
  const labelOf = (id: string) =>
    positioningsOf(summary).find((row) => row.id === id)?.label ?? '…';
  const steps = stepsOf(summary, stageId);
  if (steps.length === 0) return <p className="text-muted-foreground">{m.history_empty()}</p>;
  return (
    <>
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((step) => {
          if (step.kind === 'verdict' || step.kind === 'under_way') {
            const challenger = labelOf(step.battle.challengerId);
            const verdict = verdictOf(step.battle);
            let text = m.history_under_way({ challenger });
            if (step.kind === 'verdict' && verdict !== null) {
              const args = { verdict: VERDICT_LABEL[verdict](), challenger };
              text = step.battle.designated
                ? m.history_verdict_designated(args)
                : m.history_against(args);
            }
            return (
              <li
                key={`${step.kind}-${step.battle.id}`}
                className="flex max-w-48 items-center gap-1 text-sm text-muted-foreground"
              >
                <span>{text}</span>
                <ArrowRight aria-hidden className="size-4 shrink-0" />
              </li>
            );
          }
          const hold = step.hold === 'initial' ? 'designated' : step.hold;
          const { battle } = step;
          const challenger = battle && labelOf(battle.challengerId);
          return (
            <li
              key={`champion-${battle?.id ?? 'initial'}`}
              className={cn('flex max-w-64 flex-col gap-1 rounded-card p-2.5', HOLD_CLASS[hold])}
            >
              <span className="font-medium">{labelOf(step.championId)}</span>
              <span className="text-sm">
                {step.hold === 'initial' ? m.history_initial() : HOLD_LABEL[step.hold]()} ·{' '}
                {m.history_on({ date: formatLocalDay(step.on, locale) })}
              </span>
              {battle && challenger !== undefined && (
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  {battle.takeaway ? (
                    <span className="italic">
                      {m.history_takeaway({ takeaway: battle.takeaway })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{m.history_no_takeaway()}</span>
                  )}
                  <Button
                    variant="link"
                    size="xs"
                    // On the teal of a proven Champion, the accent text would fall under 4.5:1.
                    className="h-auto p-0 text-foreground underline max-md:min-h-11"
                    aria-label={
                      battle.takeaway
                        ? m.history_edit_takeaway({ challenger })
                        : m.history_add_takeaway({ challenger })
                    }
                    onPress={() => setEditing(battle)}
                  >
                    {battle.takeaway ? m.history_edit() : m.history_add()}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {editing && (
        <TakeawayPanel
          battle={editing}
          champion={labelOf(editing.championId)}
          challenger={labelOf(editing.challengerId)}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}

/** Edits the Takeaway of a closed Battle (CONTEXT.md, Takeaway), with “Undo”. */
function TakeawayPanel({
  battle,
  champion,
  challenger,
  onClose,
}: {
  battle: SummaryBattle;
  champion: string;
  challenger: string;
  onClose: () => void;
}) {
  const api = useApi();
  const sendGesture = useSendGesture();
  const [takeaway, setTakeaway] = useState(battle.takeaway ?? '');
  const [error, setError] = useState<string>();
  return (
    <GesturePanel title={m.takeaway_title({ champion, challenger })} onClose={onClose}>
      <Form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          void sendGesture(
            api.battles[':id'].takeaway.$post({ param: { id: battle.id }, json: { takeaway } }),
            () => m.takeaway_saved_toast(),
          ).then((refused) => {
            if (refused) setError(m.takeaway_error());
            else onClose();
          });
        }}
      >
        <GesturePanelBody>
          <TextField
            value={takeaway}
            onChange={setTakeaway}
            maxLength={TAKEAWAY_MAX_LENGTH}
            className="flex flex-col gap-1.5"
          >
            <Label>{m.takeaway_label()}</Label>
            {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- the panel was just opened: its only field takes the focus, which closing gives back. */}
            <Textarea autoFocus />
          </TextField>
          <ErrorMessage>{error}</ErrorMessage>
        </GesturePanelBody>
        <GesturePanelFooter>
          <Button variant="outline" className="max-md:min-h-11" onPress={onClose}>
            {m.close()}
          </Button>
          <Button type="submit" className="max-md:min-h-11">
            {m.takeaway_save()}
          </Button>
        </GesturePanelFooter>
      </Form>
    </GesturePanel>
  );
}
