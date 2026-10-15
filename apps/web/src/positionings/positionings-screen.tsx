import { m } from '@battlecrm/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { Lock, Paperclip, Plus } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { CHANNEL_LABEL } from '../channel.ts';
import { useLocale } from '../i18n.ts';
import { Screen } from '../screens/screen.tsx';
import { useApi } from '../session.ts';
import {
  attachmentsOf,
  isFrozen,
  positioningsOf,
  summaryQuery,
  type Summary,
  type SummaryPositioning,
} from '../summary.ts';
import { PositioningAttachments } from './attachments.tsx';
import {
  PositioningPanel,
  RelabelPanel,
  sendPositioning,
  settlePositioning,
  type PositioningPanelKind,
} from './positioning-panel.tsx';

/** Its cadence in short: “+3 d, +7 d, +14 d then 14 d” (spec UX §5.6). */
function cadenceOf({ followUps, responseWindowDays: days }: SummaryPositioning) {
  if (followUps.length === 0) return m.positioning_cadence_none({ days });
  const intervals = followUps.map((followUp) => m.positioning_days({ days: followUp.days }));
  return m.positioning_cadence({ followUps: intervals.join(', '), days });
}

/** Whether it may still change, or why not (spec UX §5.6). */
function usageOf(positioning: SummaryPositioning) {
  if (isFrozen(positioning)) return m.positioning_frozen_row({ count: positioning.trialCount });
  return positioning.used ? m.positioning_used_off_battle() : m.positioning_never_used();
}

/** The Positionings of a Stage in lineages: each modified copy under its original, one step further in. */
function lineagesOf(positionings: SummaryPositioning[]) {
  const shown = new Set(positionings.map(({ id }) => id));
  const rows: { positioning: SummaryPositioning; depth: number }[] = [];
  const walk = (positioning: SummaryPositioning, depth: number) => {
    rows.push({ positioning, depth });
    for (const copy of positionings.filter(({ derivedFromId }) => derivedFromId === positioning.id))
      walk(copy, depth + 1);
  };
  for (const root of positionings) {
    if (root.derivedFromId === null || !shown.has(root.derivedFromId)) walk(root, 0);
  }
  return rows;
}

/** The address of the workshop, with the panel open or closed. */
type WorkshopSearch = {
  stage?: string;
  positioning?: string;
  panel?: PositioningPanelKind;
};

/**
 * Positionings (spec UX §5.6): a workshop in three columns, the Stages, the Positionings of the one
 * chosen in lineages, and the record of the one chosen, in place. Stacked on narrow widths, where it
 * stays usable without being meant for a phone (spec UX §3.2).
 */
export function PositioningsScreen() {
  useLocale();
  const api = useApi();
  const navigate = useNavigate();
  const { data: summary, isError } = useQuery(summaryQuery(api));
  const search: WorkshopSearch = useSearch({ from: '/app/positionings' });

  if (summary === undefined) {
    return (
      <Screen title={m.positionings()}>
        <ErrorMessage>{isError && m.contacts_load_error()}</ErrorMessage>
      </Screen>
    );
  }

  const positionings = positioningsOf(summary);
  const selected = positionings.find(({ id }) => id === search.positioning);
  const stage =
    summary.stages.find(({ id }) => id === (selected?.stageId ?? search.stage)) ??
    summary.stages.find(({ archived }) => !archived) ??
    summary.stages[0];
  if (stage === undefined) {
    return (
      <Screen title={m.positionings()}>
        <p className="text-muted-foreground">{m.positionings_no_stage()}</p>
      </Screen>
    );
  }
  // The address always names the Stage shown: its link is the current one, and a reload keeps it.
  if (search.stage !== stage.id || (search.positioning !== undefined && !selected)) {
    const { positioning: _gone, panel: _closed, ...kept } = search;
    return (
      <Navigate
        to="/positionings"
        search={selected ? { ...search, stage: stage.id } : { ...kept, stage: stage.id }}
        replace
      />
    );
  }

  const open = (panel: PositioningPanelKind) =>
    void navigate({ to: '/positionings', search: { ...search, panel } });
  const closePanel = () => {
    const { panel: _closed, ...kept } = search;
    void navigate({ to: '/positionings', search: kept, replace: true });
  };
  const show = (positioningId: string | undefined) =>
    void navigate({
      to: '/positionings',
      search: positioningId === undefined ? { stage: stage.id } : { positioning: positioningId },
      replace: true,
    });

  let panel = null;
  if (search.panel === 'new' && !stage.archived) {
    panel = (
      <PositioningPanel
        kind="new"
        summary={summary}
        stageId={stage.id}
        source={undefined}
        onClose={closePanel}
        onSaved={show}
      />
    );
  } else if (search.panel === 'relabel' && selected) {
    panel = <RelabelPanel positioning={selected} onClose={closePanel} />;
  } else if ((search.panel === 'edit' || search.panel === 'copy') && selected) {
    panel = (
      <PositioningPanel
        key={`${search.panel}:${selected.id}`}
        kind={search.panel}
        summary={summary}
        stageId={stage.id}
        source={selected}
        onClose={closePanel}
        onSaved={show}
      />
    );
  }

  return (
    <Screen title={m.positionings()}>
      <p className="-mt-2 text-muted-foreground">{m.positionings_intro()}</p>
      <div className="grid items-start gap-4 md:grid-cols-[12rem_minmax(16rem,22rem)_minmax(0,1fr)]">
        <StageColumn summary={summary} positionings={positionings} />
        <LineageColumn
          stage={stage}
          positionings={positionings.filter(({ stageId }) => stageId === stage.id)}
          onNew={() => open('new')}
        />
        <div className="rounded-card border p-4">
          {selected ? (
            <PositioningRecord
              key={selected.id}
              positioning={selected}
              summary={summary}
              onPanel={open}
              onDeleted={() => show(undefined)}
            />
          ) : (
            <p className="text-muted-foreground">{m.positionings_choose()}</p>
          )}
        </div>
      </div>
      {panel}
    </Screen>
  );
}

const linkClass =
  'flex min-h-11 items-center gap-2 rounded-control px-3 py-2 focus-ring hover:bg-surface aria-[current=page]:bg-surface aria-[current=page]:shadow-[inset_3px_0_0_var(--accent-text)] md:min-h-9';

/** The Stages of the Funnel, each with its count of Positionings not archived. */
function StageColumn({
  summary,
  positionings,
}: {
  summary: Summary;
  positionings: SummaryPositioning[];
}) {
  const headingId = useId();
  return (
    <nav aria-labelledby={headingId} className="flex flex-col gap-1">
      <h2 id={headingId} className="px-3 text-xs tracking-wide text-muted-foreground uppercase">
        {m.positionings_stages()}
      </h2>
      <ul className="flex flex-col">
        {summary.stages.map((stage) => {
          const count = positionings.filter(
            ({ stageId, archived }) => stageId === stage.id && !archived,
          ).length;
          return (
            <li key={stage.id}>
              <Link to="/positionings" search={{ stage: stage.id }} className={linkClass}>
                <span className={cn('flex-1', stage.archived && 'text-neutral-text')}>
                  {stage.name}
                  {stage.archived && (
                    <span className="text-xs"> · {m.positionings_stage_archived()}</span>
                  )}
                </span>
                <span aria-hidden className="text-xs text-muted-foreground tabular-nums">
                  {count}
                </span>
                <span className="sr-only">{m.positionings_stage_count({ count })}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The Positionings of a Stage in lineages, the archived ones on demand (spec UX §5.6). */
function LineageColumn({
  stage,
  positionings,
  onNew,
}: {
  stage: Summary['stages'][number];
  positionings: SummaryPositioning[];
  onNew: () => void;
}) {
  const headingId = useId();
  const [showsArchived, setShowsArchived] = useState(false);
  const archivedCount = positionings.filter(({ archived }) => archived).length;
  const shown = positionings.filter(({ archived }) => showsArchived || !archived);
  const labelOf = (id: string | null) => positionings.find((p) => p.id === id)?.label;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="font-medium">
          <span className="sr-only">{m.positionings_of_stage({ stage: stage.name })}</span>
          <span aria-hidden>{stage.name}</span>
        </h2>
        {!stage.archived && (
          <Button size="sm" className="max-md:min-h-11" onPress={onNew}>
            <Plus aria-hidden />
            {m.positionings_new()}
          </Button>
        )}
      </div>
      {shown.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-card border border-dashed p-4 text-center">
          <p>{m.positionings_empty()}</p>
          <p className="text-sm text-muted-foreground">{m.positionings_empty_hint()}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {lineagesOf(shown).map(({ positioning, depth }) => (
            <li key={positioning.id} style={{ marginInlineStart: `${Math.min(depth, 4)}rem` }}>
              <Link
                to="/positionings"
                search={{ stage: stage.id, positioning: positioning.id }}
                className={cn(linkClass, 'flex-col items-stretch gap-0.5 border')}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex-1 font-medium',
                      positioning.archived && 'font-normal text-neutral-text',
                    )}
                  >
                    {positioning.label}
                  </span>
                  {positioning.archived && (
                    <span className="text-xs text-neutral-text">
                      {m.positioning_archived_tag()}
                    </span>
                  )}
                </span>
                <span className="text-xs text-neutral-text">
                  {CHANNEL_LABEL[positioning.channel]()} · {cadenceOf(positioning)}
                </span>
                {attachmentsOf(positioning).length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-neutral-text">
                    <Paperclip aria-hidden className="size-3" />
                    {m.positioning_attachments_count({
                      count: attachmentsOf(positioning).length,
                    })}
                  </span>
                )}
                {positioning.derivedFromId !== null && (
                  <span className={cn('text-xs text-neutral-text', depth > 0 && 'sr-only')}>
                    {m.positioning_copy_of_label({
                      label: labelOf(positioning.derivedFromId) ?? '…',
                    })}
                  </span>
                )}
                {positioning.archived && (
                  <span className="text-xs text-neutral-text">
                    {m.positioning_archived_by_hand()}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {isFrozen(positioning) && <Lock aria-hidden className="size-3" />}
                  {usageOf(positioning)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {archivedCount > 0 && (
        <Button
          variant="link"
          size="sm"
          className="w-fit px-0 max-md:min-h-11"
          onPress={() => setShowsArchived(!showsArchived)}
        >
          {showsArchived
            ? m.positionings_hide_archived()
            : m.positionings_show_archived({ count: archivedCount })}
        </Button>
      )}
    </section>
  );
}

/** The record of a Positioning, in place (spec UX §5.6): what it says, how it follows up, what may still change. */
function PositioningRecord({
  positioning,
  summary,
  onPanel,
  onDeleted,
}: {
  positioning: SummaryPositioning;
  summary: Summary;
  onPanel: (panel: PositioningPanelKind) => void;
  onDeleted: () => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const headingId = useId();
  const { label } = positioning;
  const positionings = positioningsOf(summary);
  const original = positionings.find(({ id }) => id === positioning.derivedFromId);
  const copies = positionings.filter(({ derivedFromId }) => derivedFromId === positioning.id);
  const stageName = summary.stages.find(({ id }) => id === positioning.stageId)?.name;
  const frozen = isFrozen(positioning);
  const act = useMutation({
    mutationFn: (gesture: 'archive' | 'unarchive' | 'delete') =>
      sendPositioning.act(api, positioning.id, gesture),
    onSuccess: async (answer, gesture) => {
      const message = {
        archive: m.positioning_archived_toast,
        unarchive: m.positioning_unarchived_toast,
        delete: m.positioning_deleted_toast,
      }[gesture]({ label });
      if ((await settlePositioning(queryClient, answer, message)) && gesture === 'delete') {
        onDeleted();
      }
    },
  });

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-muted-foreground">
          {stageName} · {CHANNEL_LABEL[positioning.channel]()}
        </p>
        <h2 id={headingId} className="text-base font-semibold">
          {label}
          {positioning.archived && (
            <span className="text-xs font-normal text-neutral-text">
              {' '}
              · {m.positioning_archived_tag()}
            </span>
          )}
        </h2>
        {original && (
          <p className="text-sm">
            {m.positioning_copy_of()}{' '}
            <Link
              to="/positionings"
              search={{ stage: original.stageId, positioning: original.id }}
              className="text-accent-text underline focus-ring"
            >
              {original.label}
            </Link>
          </p>
        )}
        {copies.length > 0 && (
          <p className="text-sm">
            {m.positioning_copies()}{' '}
            {copies.map((copy, index) => (
              <span key={copy.id}>
                {index > 0 && ', '}
                <Link
                  to="/positionings"
                  search={{ stage: copy.stageId, positioning: copy.id }}
                  className="text-accent-text underline focus-ring"
                >
                  {copy.label}
                </Link>
              </span>
            ))}
          </p>
        )}
      </div>
      {frozen ? (
        <div className="flex flex-col gap-1 rounded-control bg-surface p-3">
          <p className="flex items-center gap-1.5 font-medium">
            <Lock aria-hidden className="size-4" />
            {m.positioning_frozen_title({ count: positioning.trialCount })}
          </p>
          <p className="text-sm text-muted-foreground">{m.positioning_frozen_reason()}</p>
        </div>
      ) : (
        <p className="rounded-control bg-surface p-3 text-sm text-muted-foreground">
          {positioning.used ? m.positioning_used_editable() : m.positioning_editable()}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {frozen ? (
          <>
            <Button className="max-md:min-h-11" onPress={() => onPanel('copy')}>
              {m.positioning_create_copy()}
            </Button>
            <Button
              variant="outline"
              className="max-md:min-h-11"
              onPress={() => onPanel('relabel')}
            >
              {m.positioning_relabel()}
            </Button>
          </>
        ) : (
          <>
            <Button className="max-md:min-h-11" onPress={() => onPanel('edit')}>
              {m.positioning_edit()}
            </Button>
            <Button variant="outline" className="max-md:min-h-11" onPress={() => onPanel('copy')}>
              {m.positioning_duplicate()}
            </Button>
            {!positioning.used && (
              <Button
                variant="outline"
                className="max-md:min-h-11"
                isDisabled={act.isPending}
                onPress={() => act.mutate('delete')}
              >
                {m.positioning_delete()}
              </Button>
            )}
          </>
        )}
        <Button
          variant="outline"
          className="max-md:min-h-11"
          isDisabled={act.isPending}
          onPress={() => act.mutate(positioning.archived ? 'unarchive' : 'archive')}
        >
          {positioning.archived ? m.positioning_unarchive() : m.positioning_archive()}
        </Button>
      </div>
      <ErrorMessage>
        {act.isError ? m.auth_error() : act.data === 'behind' && m.positioning_behind()}
      </ErrorMessage>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{m.positioning_content()}</dt>
        <dd className="whitespace-pre-wrap">
          {positioning.content ?? (
            <span className="text-muted-foreground">{m.positioning_no_content()}</span>
          )}
        </dd>
        <PositioningAttachments positioning={positioning} />
        {positioning.followUps.map((followUp, rank) => (
          // The rank is the identity of a Follow-up.
          // oxlint-disable-next-line react/no-array-index-key
          <div key={rank} className="contents">
            <dt className="text-muted-foreground">
              {m.positioning_follow_up_rank({ rank: rank + 1, days: followUp.days })}
            </dt>
            <dd className="whitespace-pre-wrap">
              {followUp.message ?? (
                <span className="text-muted-foreground">{m.positioning_no_message()}</span>
              )}
            </dd>
          </div>
        ))}
        <dt className="text-muted-foreground">{m.positioning_response_window()}</dt>
        <dd>{m.positioning_response_window_value({ days: positioning.responseWindowDays })}</dd>
        <dt className="text-muted-foreground">{m.positioning_usage()}</dt>
        <dd>{usageOf(positioning)}</dd>
      </dl>
    </section>
  );
}
