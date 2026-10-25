import { STAGE_AIM_MAX_LENGTH, STAGE_NAME_MAX_LENGTH } from '@battlecrm/contract';
import { funnelOf } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { ChevronRight, GripVertical, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  Disclosure,
  DisclosurePanel,
  DropIndicator,
  GridList,
  GridListItem,
  Heading,
  TextField,
  Button as AriaButton,
  useDragAndDrop,
} from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Dialog,
} from '../components/ui/dialog.tsx';
import { ErrorMessage, FieldErrorMessage } from '../components/ui/error-message.tsx';
import { Input } from '../components/ui/input.tsx';
import { useSendGesture } from '../gesture.ts';
import { useLocale } from '../i18n.ts';
import { useIsOnline } from '../online.ts';
import { useApi } from '../session.ts';
import {
  hasServed,
  openBattleAt,
  positioningsOf,
  summaryQuery,
  type Summary,
  type SummaryChanges,
} from '../summary.ts';
import { useDraft } from './setting-fields.tsx';

type Stage = Summary['stages'][number];

/** What one Stage stands on, read from the summary: its counters, and what keeps it in the Funnel. */
function standingOf(summary: Summary, stage: Stage, funnel: Stage[]) {
  const atStage = summary.contacts.filter(({ stageId }) => stageId === stage.id);
  const prospecting = atStage.filter(({ status }) => status === 'prospecting').length;
  const battle = openBattleAt(summary, stage.id);
  return {
    prospecting,
    // Contacts of another Status keep it as the last Stage they reached (CONTEXT.md, Stage).
    keepers: atStage.length - prospecting,
    positionings: positioningsOf(summary).filter(
      ({ stageId, archived }) => stageId === stage.id && !archived,
    ).length,
    battle,
    isLast: funnel.length === 1,
    served: hasServed(summary, stage),
  };
}

type StageStanding = ReturnType<typeof standingOf>;

/** The Stage a gesture's answer names, in the Funnel it carries; the one given otherwise. */
const nameIn = (changes: SummaryChanges, stageId: string, fallback: string) =>
  changes.stages?.find(({ id }) => id === stageId)?.name ?? fallback;

/** The Stages of the Funnel that a gesture's answer carries and the summary did not: the one it added. */
const addedIn = (changes: SummaryChanges, before: Stage[]) =>
  changes.stages?.find(({ id }) => !before.some((stage) => stage.id === id));

/**
 * Sends the gestures of the Funnel (spec UX §5.8): each one says what it did, with “Undo”; refused,
 * the Funnel changed elsewhere and is read again.
 */
function useStageGestures(summary: Summary) {
  const api = useApi();
  const sendGesture = useSendGesture();
  const [refused, setRefused] = useState(false);
  const send = async (
    request: Parameters<typeof sendGesture>[0],
    message: (changes: SummaryChanges) => string,
  ) => {
    const refusal = await sendGesture(request, message);
    setRefused(refusal !== undefined);
    return refusal;
  };
  const gesture = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
  });
  const isOnline = useIsOnline();
  return {
    error: gesture.isError ? m.auth_error() : refused && m.settings_funnel_changed_elsewhere(),
    /** No gesture now: one is under way, or the device is offline (ADR 0004). */
    isDisabled: gesture.isPending || !isOnline,
    /** A new Stage, named “New Stage”, at the end or right after one; then `onAdded` with its id. */
    add: (afterId: string | undefined, onAdded: (stageId: string) => void) =>
      gesture.mutate(async () => {
        let added: string | undefined;
        await send(
          api.stages.$post({
            json: { name: m.settings_stage_new_name(), ...(afterId !== undefined && { afterId }) },
          }),
          (changes) => {
            const stage = addedIn(changes, summary.stages);
            added = stage?.id;
            return m.settings_stage_added({ stage: stage?.name ?? m.settings_stage_new_name() });
          },
        );
        if (added !== undefined) onAdded(added);
      }),
    edit: (stage: Stage, fields: { name?: string; aim?: string }) =>
      gesture.mutate(() =>
        send(api.stages[':id'].edit.$post({ param: { id: stage.id }, json: fields }), (changes) =>
          m.settings_stage_saved({ stage: nameIn(changes, stage.id, stage.name) }),
        ),
      ),
    move: (stage: Stage, afterId: string | null) =>
      gesture.mutate(() =>
        send(api.stages[':id'].move.$post({ param: { id: stage.id }, json: { afterId } }), () =>
          m.settings_stage_moved({ stage: stage.name }),
        ),
      ),
    archive: (stage: Stage, onDone: () => void) =>
      gesture.mutate(async () => {
        await send(api.stages[':id'].archive.$post({ param: { id: stage.id } }), () =>
          m.settings_stage_archived({ stage: stage.name }),
        );
        onDone();
      }),
    restore: (stage: Stage) =>
      gesture.mutate(() =>
        send(api.stages[':id'].restore.$post({ param: { id: stage.id } }), () =>
          m.settings_stage_restored({ stage: stage.name }),
        ),
      ),
    delete: (stage: Stage) =>
      gesture.mutate(() =>
        send(api.stages[':id'].delete.$post({ param: { id: stage.id } }), () =>
          m.settings_stage_deleted({ stage: stage.name }),
        ),
      ),
  };
}

type StageGestures = ReturnType<typeof useStageGestures>;

/**
 * A text of a Stage edited in place, saved once committed: on leaving the field or on `Enter`;
 * `Escape` brings it back. A name left blank is not saved, and says why.
 */
function InPlaceField({
  label,
  value,
  placeholder,
  maxLength,
  isRequired = false,
  takesFocus = false,
  onCommit,
  className,
}: {
  label: string;
  value: string;
  placeholder?: string;
  maxLength: number;
  isRequired?: boolean;
  /** Focused, its text selected, once shown. */
  takesFocus?: boolean;
  onCommit: (value: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useDraft(value);
  const [isBlank, setIsBlank] = useState(false);
  // Saved once committed: offline, it is only read (ADR 0004).
  const isOnline = useIsOnline();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!takesFocus) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [takesFocus]);
  // What was last sent: `Enter` then leaving the field sends it once, before the summary follows.
  const sent = useRef(value);
  useEffect(() => {
    sent.current = value;
  }, [value]);
  const commit = () => {
    const text = draft.trim();
    if (isRequired && text === '') {
      setIsBlank(true);
      return;
    }
    setIsBlank(false);
    if (text === value || text === sent.current) return;
    sent.current = text;
    onCommit(text);
  };
  return (
    <TextField
      aria-label={label}
      value={draft}
      onChange={(text) => {
        setDraft(text);
        if (text.trim() !== '') setIsBlank(false);
      }}
      maxLength={maxLength}
      isInvalid={isBlank}
      isDisabled={!isOnline}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          setDraft(value);
          setIsBlank(false);
        }
      }}
      className={cn('flex flex-col gap-1', className)}
    >
      <Input ref={inputRef} {...(placeholder !== undefined && { placeholder })} className="h-7" />
      <FieldErrorMessage>{m.settings_stage_name_required()}</FieldErrorMessage>
    </TextField>
  );
}

/** Why a Stage may not be archived, and where to go to lift it (spec UX §5.8). */
function ArchiveBlocker({ stage, facts, id }: { stage: Stage; facts: StageStanding; id: string }) {
  if (facts.isLast) {
    return (
      <p id={id} className="text-xs text-muted-foreground">
        {m.settings_stage_last()}
      </p>
    );
  }
  if (facts.prospecting > 0) {
    return (
      <p id={id} className="text-xs text-muted-foreground">
        {m.settings_stage_has_contacts({ count: facts.prospecting })}{' '}
        <Link to="/funnel" className="text-accent-text underline underline-offset-3 focus-ring">
          {m.settings_stage_has_contacts_link()}
        </Link>
      </p>
    );
  }
  if (facts.battle) {
    return (
      <p id={id} className="text-xs text-muted-foreground">
        {m.settings_stage_battle_open()}{' '}
        <Link
          to="/battles"
          search={{ stage: stage.id, panel: 'progress' }}
          className="text-accent-text underline underline-offset-3 focus-ring"
        >
          {m.settings_stage_battle_open_link()}
        </Link>
      </p>
    );
  }
  return null;
}

/** The confirmation of an archiving (spec UX §1, §5.8): what it does, then archive or cancel. */
function ArchiveConfirmation({
  stage,
  facts,
  gestures,
  onClose,
}: {
  stage: Stage;
  facts: StageStanding;
  gestures: StageGestures;
  onClose: () => void;
}) {
  return (
    <Dialog isOpen onOpenChange={(isOpen) => !isOpen && onClose()} className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{m.settings_stage_archive_title({ stage: stage.name })}</DialogTitle>
      </DialogHeader>
      <DialogDescription>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>{m.settings_stage_archive_leaves()}</li>
          {facts.keepers > 0 && (
            <li>{m.settings_stage_archive_keepers({ count: facts.keepers })}</li>
          )}
          <li>{m.settings_stage_archive_kept()}</li>
          <li>{m.settings_stage_archive_restore()}</li>
        </ul>
      </DialogDescription>
      <ErrorMessage>{gestures.error}</ErrorMessage>
      <DialogFooter>
        <DialogClose>{m.cancel()}</DialogClose>
        <Button isDisabled={gestures.isDisabled} onPress={() => gestures.archive(stage, onClose)}>
          {m.settings_stage_archive_confirm()}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/** One Stage of the Funnel: its handle, name, Aim, counters, and archive or delete. */
function StageRow({
  stage,
  position,
  facts,
  gestures,
  isFocused,
  onInsertAfter,
  onArchive,
}: {
  stage: Stage;
  position: number;
  facts: StageStanding;
  gestures: StageGestures;
  isFocused: boolean;
  onInsertAfter: () => void;
  onArchive: () => void;
}) {
  const blockerId = useId();
  const isBlocked = facts.isLast || facts.prospecting > 0 || facts.battle !== undefined;
  const counters = [
    m.settings_stage_prospecting({ count: facts.prospecting }),
    m.settings_stage_positionings({ count: facts.positionings }),
    facts.battle && m.settings_stage_open_battle(),
  ].filter(Boolean);
  return (
    <GridListItem
      id={stage.id}
      textValue={stage.name}
      className="group relative flex flex-col gap-1.5 border-b p-2.5 outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-accent-text data-dragging:opacity-50"
    >
      <div className="flex items-start gap-2">
        <Button
          slot="drag"
          variant="ghost"
          size="icon-xs"
          aria-label={m.settings_stage_drag({ stage: stage.name })}
          className="mt-0.5 cursor-grab text-muted-foreground"
        >
          <GripVertical />
        </Button>
        {/* The fields keep their keys: the list's arrows and Space never take them. */}
        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- keys stay in the fields. */}
        <div
          className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2"
          onKeyDown={(event) => {
            if (!event.altKey) event.stopPropagation();
          }}
        >
          <InPlaceField
            label={m.settings_stage_name({ position })}
            value={stage.name}
            maxLength={STAGE_NAME_MAX_LENGTH}
            isRequired
            takesFocus={isFocused}
            onCommit={(name) => gestures.edit(stage, { name })}
          />
          <InPlaceField
            label={m.settings_stage_aim({ stage: stage.name })}
            value={stage.aim ?? ''}
            placeholder={m.settings_stage_aim_placeholder()}
            maxLength={STAGE_AIM_MAX_LENGTH}
            onCommit={(aim) => gestures.edit(stage, { aim })}
          />
        </div>
        {facts.served ? (
          <Button
            variant="outline"
            size="sm"
            aria-label={m.settings_stage_archive_label({ stage: stage.name })}
            isDisabled={isBlocked || gestures.isDisabled}
            {...(isBlocked && { 'aria-describedby': blockerId })}
            onPress={onArchive}
          >
            {m.settings_stage_archive()}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            aria-label={m.settings_stage_delete_label({ stage: stage.name })}
            isDisabled={facts.isLast || gestures.isDisabled}
            {...(facts.isLast && { 'aria-describedby': blockerId })}
            onPress={() => gestures.delete(stage)}
          >
            {m.settings_stage_delete()}
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-0.5 pl-8">
        <p className="text-xs text-muted-foreground tabular-nums">{counters.join(' · ')}</p>
        {(facts.served ? isBlocked : facts.isLast) && (
          <ArchiveBlocker stage={stage} facts={facts} id={blockerId} />
        )}
      </div>
      {/* Insertion on hover, or by the keyboard: a Stage right after this one. */}
      <Button
        variant="outline"
        size="icon-xs"
        aria-label={m.settings_stage_insert_after({ stage: stage.name })}
        isDisabled={gestures.isDisabled}
        onPress={onInsertAfter}
        className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-background opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Plus />
      </Button>
    </GridListItem>
  );
}

/** The archived Stages, under their disclosure: each restored at its place (spec UX §5.8). */
function ArchivedStages({ stages, gestures }: { stages: Stage[]; gestures: StageGestures }) {
  if (stages.length === 0) return null;
  return (
    <Disclosure className="group/archived flex flex-col gap-2">
      <Heading level={3}>
        <AriaButton
          slot="trigger"
          className="flex items-center gap-1 rounded-control text-sm font-medium focus-ring"
        >
          <ChevronRight
            aria-hidden
            className="size-4 transition-transform group-data-expanded/archived:rotate-90 motion-reduce:transition-none"
          />
          {m.settings_archived_stages({ count: stages.length })}
        </AriaButton>
      </Heading>
      <DisclosurePanel>
        <ul className="flex flex-col rounded-card border">
          {stages.map((stage) => (
            <li
              key={stage.id}
              className="flex items-center justify-between gap-2 border-b p-2.5 last:border-b-0"
            >
              <span className="min-w-0 truncate text-muted-foreground">{stage.name}</span>
              <Button
                variant="outline"
                size="sm"
                aria-label={m.settings_stage_restore_label({ stage: stage.name })}
                isDisabled={gestures.isDisabled}
                onPress={() => gestures.restore(stage)}
              >
                {m.settings_stage_restore()}
              </Button>
            </li>
          ))}
        </ul>
      </DisclosurePanel>
    </Disclosure>
  );
}

/**
 * The Funnel in Settings (spec UX §5.8), the only place it is edited: its Stages in order, each
 * moved by its handle (mouse or keyboard, ST-61) or by `Alt+↑/↓`, renamed and given an Aim in
 * place; one added at the end or inserted; archived once it served, deleted otherwise; restored from
 * “Archived Stages”. `focusStageId` names the Stage whose name takes the focus (“Rename” from the
 * kanban).
 */
export function FunnelSettings({ focusStageId }: { focusStageId?: string | undefined }) {
  useLocale();
  const { data: summary } = useQuery(summaryQuery(useApi()));
  if (summary === undefined) return null;
  return <FunnelEditor summary={summary} focusStageId={focusStageId} />;
}

function FunnelEditor({
  summary,
  focusStageId,
}: {
  summary: Summary;
  focusStageId: string | undefined;
}) {
  const introId = useId();
  const gestures = useStageGestures(summary);
  const funnel = funnelOf(summary.stages);
  const archived = summary.stages.filter((stage) => stage.archived);
  const [focused, setFocused] = useState(focusStageId);
  const [archiving, setArchiving] = useState<Stage>();
  const ids = funnel.map(({ id }) => id);

  /** Moves a Stage right after another one, first after `null`. */
  const moveAfter = (stageId: string, afterId: string | null) => {
    const stage = funnel.find(({ id }) => id === stageId);
    if (stage) gestures.move(stage, afterId);
  };

  // Offline, the order is only read (ADR 0004).
  const isOnline = useIsOnline();
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) =>
      [...keys].map((key) => ({ 'text/plain': funnel.find(({ id }) => id === key)?.name ?? '' })),
    // The line where it would land, between two Stages.
    renderDropIndicator: (target) => (
      <DropIndicator
        target={target}
        className="h-0.5 bg-transparent outline-none data-drop-target:bg-accent-text"
      />
    ),
    onReorder: ({ keys, target }) => {
      const [key] = [...keys];
      if (key === undefined || key === target.key) return;
      const others = ids.filter((id) => id !== key);
      const index = others.indexOf(String(target.key));
      const afterId =
        target.dropPosition === 'after' ? String(target.key) : (others[index - 1] ?? null);
      moveAfter(String(key), afterId);
    },
  });

  /** `Alt+↑/↓` on a Stage moves it one place (spec UX §5.8). */
  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    if (!isOnline) return;
    const row = event.target instanceof Element ? event.target.closest('[data-key]') : null;
    const stageId = row?.getAttribute('data-key');
    const index = stageId ? ids.indexOf(stageId) : -1;
    if (stageId == null || index < 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'ArrowUp' && index > 0) moveAfter(stageId, ids[index - 2] ?? null);
    if (event.key === 'ArrowDown' && index < ids.length - 1)
      moveAfter(stageId, ids[index + 1] ?? null);
  };

  return (
    <div className="flex flex-col gap-4">
      <p id={introId} className="text-sm text-muted-foreground">
        {m.settings_funnel_intro()}
      </p>
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Alt+↑/↓ on the Stage focused within. */}
      <div onKeyDownCapture={onKeyDownCapture}>
        <GridList
          aria-label={m.settings_funnel_stages()}
          aria-describedby={introId}
          {...(isOnline && { dragAndDropHooks })}
          keyboardNavigationBehavior="tab"
          disallowTypeAhead
          className="flex flex-col rounded-card border outline-none data-drop-target:ring-2 data-drop-target:ring-accent-text"
        >
          {funnel.map((stage) => (
            <StageRow
              key={stage.id}
              stage={stage}
              position={ids.indexOf(stage.id) + 1}
              facts={standingOf(summary, stage, funnel)}
              gestures={gestures}
              isFocused={focused === stage.id}
              onInsertAfter={() => gestures.add(stage.id, setFocused)}
              onArchive={() => setArchiving(stage)}
            />
          ))}
        </GridList>
      </div>
      <ErrorMessage>{archiving === undefined && gestures.error}</ErrorMessage>
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        isDisabled={gestures.isDisabled}
        onPress={() => gestures.add(undefined, setFocused)}
      >
        <Plus aria-hidden />
        {m.settings_stage_add()}
      </Button>
      <ArchivedStages stages={archived} gestures={gestures} />
      {archiving && (
        <ArchiveConfirmation
          stage={archiving}
          facts={standingOf(summary, archiving, funnel)}
          gestures={gestures}
          onClose={() => setArchiving(undefined)}
        />
      )}
    </div>
  );
}
